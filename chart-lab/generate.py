"""Build offline signal fixtures by evaluating the preserved Python strategy sources.

No exchange, orders, wallet, trades or live credentials are involved. DataProvider
only serves deterministic synthetic candles. The shipped website needs no Python.
"""
from __future__ import annotations
import argparse, ast, hashlib, importlib.metadata, json, math, random, re, sys, warnings
from pathlib import Path
import numpy as np
import pandas as pd
from freqtrade.enums import RunMode
from freqtrade.exchange import timeframe_to_minutes
from freqtrade.strategy import IStrategy

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'sources'/'strategies'
OUT=ROOT/'chart-data'
SIGNALS=('enter_long','exit_long','enter_short','exit_short')
# Legacy sources import Python's math through a removed NumPy alias. This does
# not replace any indicator or condition; every affected fixture discloses it.
np.lib.math=math
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', category=pd.errors.PerformanceWarning)

class Capture:
    def __init__(self): self.phase=None; self.checks={}; self.columns={}; self.index=None
    def record(self,value,label,line,scope,names):
        original=value
        if self.phase and isinstance(value,np.ndarray) and value.dtype==bool and value.ndim==1 and len(value)==len(self.index): value=pd.Series(value,index=self.index)
        if self.phase and isinstance(value,pd.Series) and pd.api.types.is_bool_dtype(value):
            bindings={n:scope[n] for n in names if n in scope and isinstance(scope[n],(str,int,float,bool))}
            key=(self.phase,line,label,json.dumps(bindings,sort_keys=True))
            self.checks[key]={'phase':self.phase,'source':label,'line':line,'bindings':bindings,'values':value.copy()}
        return original
    def column(self,value,name,line):
        if self.phase and isinstance(value,pd.Series) and isinstance(name,str):
            self.columns[name]=value.copy()
            if pd.api.types.is_bool_dtype(value):self.record(value,f"dataframe[{name!r}]",line,{},[])
        return value

class Instrument(ast.NodeTransformer):
    def __init__(self,source):self.source=source
    def wrap(self,node):
        label=ast.get_source_segment(self.source,node) or ast.unparse(node)
        line=node.lineno
        names=sorted({n.id for n in ast.walk(node) if isinstance(n,ast.Name) and isinstance(n.ctx,ast.Load)})
        node=self.generic_visit(node)
        return ast.copy_location(ast.Call(func=ast.Attribute(value=ast.Name(id='_chart_capture',ctx=ast.Load()),attr='record',ctx=ast.Load()),args=[node,ast.Constant(label),ast.Constant(line),ast.Call(func=ast.Name(id='locals',ctx=ast.Load()),args=[],keywords=[]),ast.List(elts=[ast.Constant(n) for n in names],ctx=ast.Load())],keywords=[]),node)
    def visit_Compare(self,node):return self.wrap(node)
    def visit_Call(self,node):
        if isinstance(node.func,ast.Attribute) and node.func.attr in ('crossed_above','crossed_below','between','isclose','gt','lt','ge','le','eq','ne'):return self.wrap(node)
        return self.generic_visit(node)
    def visit_Subscript(self,node):
        node=self.generic_visit(node)
        if isinstance(node.ctx,ast.Load) and isinstance(node.value,ast.Name) and node.value.id in ('dataframe','df'):
            return ast.copy_location(ast.Call(func=ast.Attribute(value=ast.Name(id='_chart_capture',ctx=ast.Load()),attr='column',ctx=ast.Load()),args=[node,node.slice,ast.Constant(node.lineno)],keywords=[]),node)
        return node

def candles(seed:int,mode:str,minutes:int,n=7200):
    rng=np.random.default_rng(seed);t=np.arange(n,dtype=float)
    # Several volatility regimes, trends and reversals plus isolated long wicks.
    # Values are generated independently of the strategy's conditions.
    if mode=='trend':drift=.0008*np.sin(t/75)+.00018
    elif mode=='range':drift=.0007*np.sin(t/8)+.00025*np.sin(t/35)
    else:drift=-.00055+.0011*np.sin(t/42)
    noise=rng.normal(0,.0017,n)*(1+(np.floor(t/150)%3))
    shocks=np.where((t.astype(int)%211)==0,rng.choice([-1,1],n)*.03,0)
    c=100*np.exp(np.cumsum(drift+noise+shocks));o=np.r_[c[0],c[:-1]]
    wick=rng.uniform(.0003,.004,n)*c
    h=np.maximum(o,c)+wick*rng.uniform(.2,1.8,n);l=np.minimum(o,c)-wick*rng.uniform(.2,1.8,n)
    # Small-body, long-lower-shadow candles can occur naturally in the fixtures.
    hammer=np.arange(n)%37==0;o[hammer]=c[hammer]*1.0003;h[hammer]=np.maximum(o[hammer],c[hammer])+c[hammer]*.00005;l[hammer]=c[hammer]*(1-rng.uniform(.006,.018,hammer.sum()))
    volume=rng.lognormal(5,.55,n)*(1+np.abs(noise)*80)
    return pd.DataFrame({'date':pd.date_range('2024-01-01',periods=n,freq=f'{minutes}min',tz='UTC'),'open':o,'high':h,'low':l,'close':c,'volume':volume})

class SyntheticProvider:
    def __init__(self,base,timeframe,pair,seed,mode,cutoff=None):
        self.base=base;self.timeframe=timeframe;self.pair=pair;self.seed=seed;self.mode=mode;self.cutoff=cutoff;self.runmode=RunMode.BACKTEST;self.cache={}
    def current_whitelist(self):return [self.pair]
    def market(self,pair):
        tokens=pair.split('/');return {'base':tokens[0],'quote':tokens[1].split(':')[0],'symbol':pair}
    def get_pair_dataframe(self,pair,timeframe,*args,**kwargs):
        key=(pair,timeframe)
        if key not in self.cache:
            minutes=timeframe_to_minutes(self.timeframe);other=self.base if pair==self.pair else candles(self.seed+sum(map(ord,pair)),self.mode,minutes,len(self.base))
            target=timeframe_to_minutes(timeframe)
            if target<minutes:raise ValueError('Synthetic provider cannot downsample to a smaller timeframe')
            if target>minutes:
                other=other.set_index('date').resample(f'{target}min',label='left',closed='left').agg({'open':'first','high':'max','low':'min','close':'last','volume':'sum'}).dropna().reset_index()
                # Omit an unfinished final informative candle; framework helpers
                # shift completed high-timeframe candles to their close time.
                end=self.base.date.iloc[-1]+pd.Timedelta(minutes=minutes)
                other=other[other.date+pd.Timedelta(minutes=target)<=end]
            if self.cutoff is not None:other=other[other.date+pd.Timedelta(minutes=target)<=self.cutoff]
            self.cache[key]=other.copy()
        return self.cache[key].copy()

def load(path,instrument=True):
    source=path.read_text();tree=ast.parse(source)
    name=next(n.name for n in tree.body if isinstance(n,ast.ClassDef))
    cap=Capture();namespace={'__name__':'chart_fixture_'+name,'__file__':str(path),'_chart_capture':cap}
    random.seed(1701)
    code=ast.fix_missing_locations(Instrument(source).visit(tree)) if instrument else tree
    exec(compile(code,str(path),'exec'),namespace)
    return namespace[name],cap

def run(path,mode='trend',instrument=True,base=None,cut=None):
    cls,cap=load(path,instrument)
    config={'stake_currency':'USDT','runmode':RunMode.BACKTEST,'trading_mode':'futures' if '/futures/' in str(path) else 'spot','candle_type_def':'spot','exchange':{'pair_whitelist':['DEMO/USDT']},'dry_run':True,'freqai':{'enabled':False}}
    strategy=cls(config);strategy.chart_notes=[]
    if not hasattr(strategy,'timeframe'):
        strategy.timeframe='5m';strategy.chart_notes.append('源码未声明周期；此样例显式采用外部配置 timeframe=5m。')
    try:strategy.ft_load_hyper_params(False)
    except Exception:
        if cls.__name__!='FReinforcedStrategy':raise
        strategy.chart_notes.append('当前 Freqtrade 无法识别部分参数的 space；本图仅按源码声明 default 值计算规则，实际加载策略前需修复参数声明。')
    minutes=timeframe_to_minutes(strategy.timeframe)
    seed=int(hashlib.sha256(str(path.relative_to(SOURCE)).encode()).hexdigest()[:8],16)
    supplied_base=base is not None
    base=base if base is not None else candles(seed,mode,minutes,8000 if cls.__name__=='TrendRiderStrategy' else 4200)
    if cls.__name__ in ('PowerTower','GodStraNew') and mode=='range' and not supplied_base:
        base=base.copy();base[['open','high','low','close']]*=.001;strategy.chart_notes.append('此样例使用约 0.1 的价格量纲，以展示幂运算或反三角函数对价格单位的敏感性。')
    frame=base.iloc[:cut].copy() if cut else base.copy()
    cutoff=frame.date.iloc[-1]+pd.Timedelta(minutes=minutes)
    strategy.dp=SyntheticProvider(base,strategy.timeframe,'DEMO/USDT',seed,mode,cutoff)
    frame=strategy.advise_indicators(frame,{'pair':'DEMO/USDT'})
    cap.phase='entry';cap.index=frame.index;frame=strategy.populate_entry_trend(frame,{'pair':'DEMO/USDT'})
    cap.phase='exit';cap.index=frame.index;frame=strategy.populate_exit_trend(frame,{'pair':'DEMO/USDT'})
    cap.phase=None
    return strategy,frame,cap,base

def probe(ids=None):
    results=[]
    for path in sorted(SOURCE.rglob('*.py')):
        id=str(path.relative_to(SOURCE).with_suffix(''))
        if ids and id not in ids:continue
        try:
            strategy,frame,cap,base=run(path)
            counts={s:int(frame[s].eq(1).sum()) if s in frame else 0 for s in SIGNALS}
            result={'id':id,'counts':counts,'columns':list(cap.columns),'checks':len(cap.checks)}
            print(id,counts,'checks',len(cap.checks),flush=True)
        except Exception as e:
            import traceback
            result={'id':id,'error':str(e),'trace':traceback.format_exc()}
            print(id,'ERROR',type(e).__name__,str(e)[:180],flush=True)
        results.append(result)
    (ROOT/'chart-lab'/'probe.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')

def clean(v):
    if isinstance(v,(bool,np.bool_)):return bool(v)
    if isinstance(v,(float,int,np.number)):return round(float(v),9) if np.isfinite(v) else None
    if v is None or pd.isna(v):return None
    return str(v)
def vector(series,index):return [clean(v) for v in series.reindex(index).tolist()]
def signal_series(frame,key):return frame[key] if key in frame else pd.Series(0,index=frame.index)

def make_case(strategy,frame,cap,mode):
    if len(frame)<640:raise ValueError('Insufficient computed candles after warmup')
    flags={k:signal_series(frame,k).eq(1) for k in SIGNALS}
    events={k:(v&~v.shift(1,fill_value=False)).astype(int) for k,v in flags.items()}
    entry=events['enter_long']+events['enter_short'];exit=events['exit_long']+events['exit_short']
    e=entry.rolling(120,min_periods=120).sum();x=exit.rolling(120,min_periods=120).sum()
    score=e*15+x*2+((e>0)&(x>0))*100
    burn=5000 if strategy.__class__.__name__=='TrendRiderStrategy' else max(1000,getattr(strategy,'startup_candle_count',0)+200)
    valid=score.iloc[min(burn,len(frame)-320):]
    end=int(np.argmax(valid.to_numpy()))+min(burn,len(frame)-320)+1 if valid.max()>0 else len(frame)
    # Keep context after the selected event instead of pinning the entry to the right edge.
    end=min(len(frame),max(320,end+35));segment=frame.iloc[end-320:end];idx=segment.index
    rows=[{**{k:clean(r[k]) for k in ('open','high','low','close','volume')},'date':r.date.strftime('%Y-%m-%dT%H:%M:00Z')} for _,r in segment.iterrows()]
    signals={k:vector(signal_series(frame,k),idx) for k in SIGNALS}
    features=[];overlays=[];oscillators=[];price=float(segment.close.median())
    # Only columns actually read while constructing source signals are plotted.
    for name,values in cap.columns.items():
        if name in ('date',*SIGNALS):continue
        data=vector(values,idx);item={'label':name,'data':data};features.append(item)
        if name in ('open','high','low','close','volume') or not pd.api.types.is_numeric_dtype(values) or pd.api.types.is_bool_dtype(values):continue
        finite=[v for v in data[200:] if isinstance(v,(int,float)) and not isinstance(v,bool)]
        if not finite:continue
        likely_price=bool(re.search(r'ema|sma|sar|upper|lower|middle|mid$|trend$|kijun|ichimoku|ha_open|ha_close',name,re.I)) and not re.search(r'rsi|macd|width|delta|ratio|percent|volume|vma|emarsi',name,re.I)
        if likely_price and .25*price<np.median(finite)<4*price and len(overlays)<5:overlays.append(item)
        else:oscillators.append(item)
    checks=[{**{k:v for k,v in check.items() if k!='values'},'values':vector(check['values'],idx)} for check in cap.checks.values()]
    counts={k:sum(v==1 for v in values[200:]) for k,values in signals.items()}
    title={'trend':'趋势转折','range':'区间震荡','fall':'下行与反弹'}[mode]
    if strategy.__class__.__name__ in ('PowerTower','GodStraNew') and mode=='range':title='小价格量纲对照'
    return {'title':title,'rows':rows,'signals':signals,'counts':counts,'features':features,'overlays':overlays,'oscillators':oscillators,'checks':checks,'selectionNote':'从固定合成行情中选取便于观察信号的 120 根；触发次数不代表真实市场频率。','warning':'','windowEnd':end,'fullCounts':{k:int(v.sum()) for k,v in flags.items()}},segment

def quiet_run(*args,**kwargs):
    from contextlib import redirect_stdout
    import io
    with redirect_stdout(io.StringIO()):return run(*args,**kwargs)

def generate(ids=None):
    OUT.mkdir(exist_ok=True)
    lessons={l['id']:l for p in (ROOT/'lessons').glob('*.json') for l in json.loads(p.read_text())}
    versions={p:importlib.metadata.version(p) for p in ['freqtrade','TA-Lib','technical','numpy','pandas','ta']}
    report=[]
    for path in sorted(SOURCE.rglob('*.py')):
        id=str(path.relative_to(SOURCE).with_suffix(''))
        if ids and id not in ids:continue
        source=path.read_text();tree=ast.parse(source);clsnode=next(n for n in tree.body if isinstance(n,ast.ClassDef));methods={n.name for n in clsnode.body if isinstance(n,ast.FunctionDef)}
        payload={'id':id,'sourceHash':hashlib.sha256(path.read_bytes()).hexdigest(),'cases':[]}
        try:
            notes=[];first=None
            for mode in ['trend','range','fall']:
                strategy,frame,cap,base=quiet_run(path,mode)
                case,segment=make_case(strategy,frame,cap,mode)
                notes.extend(strategy.chart_notes)
                # These source issues are already documented in the audited lessons.
                known_bias=lessons[id]['status']=='biased' or any('未来' in p or '全样本' in p for p in lessons[id]['pitfalls'])
                if known_bias:case['warning']='此源码含未来数据 / 全样本依赖风险。图上只展示它实际写出的信号，不能把这些历史标记当作实时可获得的买卖点。'
                if not any(case['counts'].values()):case['warning']+=' 本段没有条件值等于 1 的信号；可逐根查看失败条件。'
                payload['cases'].append(case)
                if first is None:first=(strategy,frame,cap,base,case)
            strategy,frame,cap,base,case=first
            # Compare instrumented output against untouched source execution.
            _,plain,_,_=quiet_run(path,'trend',False,base=base)
            for key in SIGNALS:pd.testing.assert_series_equal(signal_series(frame,key),signal_series(plain,key),check_names=False)
            audit={'originalSignalsMatch':True}
            cut=min(len(base)-1,max(1100,int(frame.index[case['windowEnd']-35])+1))
            try:
                _,prefix,pcap,_=quiet_run(path,'trend',base=base,cut=cut)
                common=frame.index.intersection(prefix.index)[-40:]
                changed=[]
                for key in SIGNALS:
                    a=signal_series(frame,key).reindex(common).fillna(0);b=signal_series(prefix,key).reindex(common).fillna(0)
                    if not a.equals(b):changed.append(key)
                for name,values in cap.columns.items():
                    if name not in pcap.columns:continue
                    a=values.reindex(common);b=pcap.columns[name].reindex(common)
                    if pd.api.types.is_numeric_dtype(a):same=np.allclose(a.to_numpy(dtype=float),b.to_numpy(dtype=float),rtol=1e-7,atol=1e-9,equal_nan=True)
                    else:same=a.fillna('').equals(b.fillna(''))
                    if not same:changed.append(name)
                audit['prefixChanged']=changed
                if changed:
                    for c in payload['cases']:c['warning']+=' 截断样本核对发现历史值改变：'+', '.join(changed[:8])+'；请勿按这些标记推断可实现的历史收益。'
            except Exception as e:audit['prefixError']=type(e).__name__+': '+str(e)
            from freqtrade.strategy.parameters import BaseParameter
            params=[]
            for name in vars(type(strategy)):
                p=getattr(strategy,name)
                if isinstance(p,BaseParameter):
                    origin='声明 default'
                    for space in ('buy','sell','protection'):
                        if name in getattr(strategy,space+'_params',{}) and p.load:origin=space+'_params'
                    params.append({'name':name,'value':clean(p.value),'origin':origin})
            callbacks=[]
            if 'custom_exit' in methods:callbacks.append('custom_exit 还需持仓与当前收益，未画成固定卖点')
            if 'custom_stoploss' in methods:callbacks.append('custom_stoploss 还需开仓价 / 持仓状态，未模拟移动止损成交')
            if 'adjust_trade_position' in methods:callbacks.append('分片 / 加减仓由 adjust_trade_position 和订单状态决定，不是每个标记都再下单')
            if 'confirm_trade_entry' in methods:callbacks.append('开仓候选还需通过 confirm_trade_entry 的确认')
            if not getattr(strategy,'can_short',False) and any(c['fullCounts']['enter_short'] for c in payload['cases']):callbacks.append('源码写了开空列但未启用 can_short；这些标记不代表允许开空')
            if not any(c['fullCounts']['exit_long'] or c['fullCounts']['exit_short'] for c in payload['cases']):callbacks.append('这些样例没有平仓条件信号；请查看「止盈与止损」中的 ROI、止损和回调路径')
            if id=='futures/TrendFollowingStrategy':callbacks.append('平仓的均线交叉与 OBV 方向互相矛盾，正成交量下不会同时成立')
            compatibility=list(dict.fromkeys(notes))
            if 'from numpy.lib import math' in source:compatibility.append('兼容适配：已移除的 numpy.lib.math 别名映射到 Python math，未修改指标公式或交易条件。')
            payload.update({'timeframe':strategy.timeframe,'parameters':params,'parameterPolicy':'参数采用源码 buy_params / sell_params（load=True）覆盖声明 default；不加载外部参数文件。样例交易对 DEMO/USDT，辅助币种与高周期也使用明确生成的合成数据。','method':'直接执行本地源码快照的指标、入场与退出方法，使用实际 TA-Lib / QTPyLib / technical 实现；条件记录器已与不插入记录器的原始信号逐项核对。','environment':'Python '+sys.version.split()[0]+' · '+' · '.join(k+' '+v for k,v in versions.items()),'compatibility':compatibility,'notModeled':callbacks,'boundary':'标记是原始开平仓条件，不是成交。未模拟持仓筛选、同根冲突、ROI、固定 / 移动止损、手续费或限价单成交；数值显示会舍入，条件按完整精度计算。','audit':audit})
            if compatibility and any('space' in n for n in compatibility):payload['boundary']+=' 此策略的参数加载存在兼容问题；本图仅演示声明默认值下的规则。'
            print(id,[(c['title'],c['counts']) for c in payload['cases']],flush=True)
            report.append({'id':id,'counts':[c['counts'] for c in payload['cases']],'audit':audit,'compatibility':compatibility})
        except Exception as e:
            import traceback
            payload['error']=type(e).__name__+': '+str(e);payload['explanation']='原始源码在固定样例环境中无法完成计算；没有用通用指标交叉冒充本策略信号。'
            report.append({'id':id,'error':payload['error'],'trace':traceback.format_exc()});print(id,'ERROR',payload['error'],flush=True)
        (OUT/(id.replace('/','--')+'.js')).write_text('window.SignalLab.register('+json.dumps(id)+','+json.dumps(payload,ensure_ascii=False,separators=(',',':'),allow_nan=False)+');\n')
    (ROOT/'chart-lab'/'audit.json').write_text(json.dumps({'versions':versions,'results':report},ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--ids',nargs='*');parser.add_argument('--probe',action='store_true');args=parser.parse_args()
    (probe if args.probe else generate)(args.ids)
