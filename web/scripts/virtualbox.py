#encoding: utf-8

import urllib, urllib2, cookielib
import re, json

# 获取最新版本的virtualbox-win
def main():
    html = urllib2.urlopen('https://www.virtualbox.org/wiki/Downloads').read()
    d = re.compile('<a class="ext-link" href="(.*?)">.*?Windows hosts</a>').search(html)
    link = d.group(1).strip()
    version = re.compile('\\d+(?:\\.\\d+)+').search(link).group(0)
    print json.dumps({
        'status': 'success',
        'version': version,
        'link': link
    })

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print json.dumps({
            'status': 'error',
            'error_message': str(e)
        })