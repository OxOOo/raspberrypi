# encoding: utf-8

import netifaces, mechanize
import alog
import strictyaml
import sys, os, time
from urllib import urlencode
import hashlib
from bs4 import BeautifulSoup

reload(sys)
sys.setdefaultencoding('utf-8')

config = strictyaml.load(open('config.yml').read())
WIRELESS = config['wireless']
USEREGNAME = config['useregname']
USEREGPASS = config['useregpass']

def checkIP(ip):
    n = int(ip.split('.')[0])
    return 127 < n and n < 192

def getWirelessIP():
    alog.info('获取无线网卡上的IP地址')
    addresses = netifaces.ifaddresses(WIRELESS)
    if netifaces.AF_INET in addresses:
        ip = addresses[netifaces.AF_INET][0]['addr'].strip()
        alog.info('无线网卡IP: %s' % (ip))
        if not checkIP(ip):
            alog.info('无线网卡IP(%s)检查失败' % (ip))
            return None
        return ip
    alog.info('无线网卡没有IP地址')
    return None

def registerIP(ip):
    browser = mechanize.Browser()
    
    m2 = hashlib.md5()
    m2.update(USEREGPASS)
    page = browser.open('http://usereg.tsinghua.edu.cn/do.php', urlencode({'user_login_name': USEREGNAME, 'user_password': m2.hexdigest(), 'action': 'login'}))
    res = page.read().decode('gb2312')
    alog.info('登录usereg的返回结果：%s' % (res))
    assert res.strip() == 'ok'

    page = browser.open('http://usereg.tsinghua.edu.cn/online_user_ipv4.php')
    soup = BeautifulSoup(page.read().decode('gb2312'), 'html.parser')
    ips = []
    for x in soup.find_all('table')[2].find_all('tr')[1:]:
        ips.append(x.find_all('td')[1].text.strip())
    alog.info('已上线的IP：%s' % (','.join(ips)))
    if ip not in ips:
        browser.open('http://usereg.tsinghua.edu.cn/ip_login.php')
        browser.select_form(nr=0)
        browser.form['user_ip'] = ip
        page = browser.submit()
        if '上线请求已发送' in page.read().decode('gb2312'):
            alog.info('上线请求已发送')
    else:
        alog.info('已经上线，不发送上线请求')

def main():
    while True:
        try:
            ip = getWirelessIP()
            if ip:
                registerIP(ip)
        except Exception as e:
            alog.fatal('发生错误：%s' % (type(e)))
            alog.fatal(e.message)
        time.sleep(10) # 10秒钟

if __name__ == '__main__':
    main()