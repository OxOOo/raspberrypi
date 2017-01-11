#encoding: utf-8

import urllib, urllib2, cookielib
import re, json

# 获取最新版本的ubuntu
def main():
    cj = cookielib.CookieJar()
    opener = urllib2.build_opener(urllib2.HTTPCookieProcessor(cj))
    urllib2.install_opener(opener)

    html = urllib2.urlopen('http://ftp.riken.jp/Linux/ubuntu-releases/').read()
    d = re.compile('<li><a href.*?>Ubuntu (.*?) .*?</a>').search(html)
    version = d.group(1).strip()
    print json.dumps({
        'status': 'success',
        'version': version,
        'link': 'http://ftp.riken.jp/Linux/ubuntu-releases/%s/ubuntu-%s-desktop-amd64.iso' % (version, version)
    })

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print json.dumps({
            'status': 'error',
            'error_message': str(e)
        })