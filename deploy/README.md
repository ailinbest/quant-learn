# jp-vps 部署

- 仓库：`https://github.com/ailinbest/quant-learn.git`
- 服务器源码：`/home/work/workspace/quant-learn`
- 访问地址：`https://108.171.45.187/quant-learn/`
- Nginx 公共目录：`/var/www/quant-learn`，指向一个完整版本目录。
- 与原有看板共享 HTTPS 证书；原有根路径 `/` 继续由看板处理。

## 首次安装

```sh
cd /home/work/workspace
git clone https://github.com/ailinbest/quant-learn.git
cd quant-learn
sudo sh deploy/publish.sh
sudo install -m 644 deploy/nginx-location.conf /etc/nginx/snippets/quant-learn.conf
```

备份 `/etc/nginx/sites-available/quant-dashboard`，然后在其中监听 443 的 `server` 块内添加一次：

```nginx
include /etc/nginx/snippets/quant-learn.conf;
```

```sh
sudo nginx -t
sudo systemctl reload nginx
curl -f https://108.171.45.187/quant-learn/ -o /dev/null
```

80 端口保留原有 HTTPS 跳转。无需增加监听端口、后台 Python 进程或 Node 服务。Nginx 已启用开机启动；TLS 证书续期沿用原有服务器设置。

## 后续更新

本地修改课程和代码后，在仓库根目录执行：

```sh
python3 refresh-catalog.py
node --test model.test.js library.test.js signal-lab.test.js
python3 build-site.py
git add .
git commit -m "Update strategy lessons"
git push origin main
```

再登录服务器发布：

```sh
ssh jp-vps
cd /home/work/workspace/quant-learn
git pull --ff-only origin main
sudo sh deploy/publish.sh
```

修改策略源码时，还需按 `chart-lab/README.md` 重新生成信号数据；普通文字修改不需要安装计算环境。

发布脚本只复制网页、脚本、样式、离线信号样例和许可证；不会公开 `.git`、构建脚本、测试和课程编辑文件。页面内仍可查看作为教学内容嵌入的策略源码。每次发布创建新目录，完成复制后原子切换符号链接，普通内容更新不需要重载 Nginx。`version.json` 记录公开文件的 SHA-256，便于核对发布内容。

旧版本保存在 `/var/www/quant-learn-releases/`。需要回滚时，选择旧版本绝对路径，把 `/var/www/quant-learn` 符号链接原子切回该目录即可。若修改 Nginx 配置，先备份，始终在 `nginx -t` 通过后再 reload。
