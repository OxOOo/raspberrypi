# encoding: utf-8

import alog
from datetime import datetime, timedelta, date
import os, time, sys, re
import requests

def getBeijinTime():
    data = requests.get('http://www.beijing-time.org/time15.asp').text

    year = int(re.compile(r'nyear=(\d+);').search(data).group(1))
    month = int(re.compile(r'nmonth=(\d+);').search(data).group(1))
    day = int(re.compile(r'nday=(\d+);').search(data).group(1))
    hrs = int(re.compile(r'nhrs=(\d+);').search(data).group(1))
    minute = int(re.compile(r'nmin=(\d+);').search(data).group(1))
    sec = int(re.compile(r'nsec=(\d+);').search(data).group(1))

    return datetime(year, month, day, hrs, minute, sec)

def nextTimepoint():
    now = getBeijinTime()
    alog.info('当前时间：' + now.strftime('%F %R'))
    if now.weekday() == 4 or now.weekday() == 5: # 星期五和星期六
        n = now
        t = now.date() + timedelta(days=1)
        return (datetime(t.year, t.month, t.day) - n).seconds + 5
    else:
        n = now
        t = now.date()
        p = datetime(t.year, t.month, t.day, 22, 55)
        if p < n: return 0
        return (p - n).seconds + 5

def main():
    while True:
        try:
            nextPoint = nextTimepoint()
            alog.info('时间点(%d):%.2f 小时'%(nextPoint, float(nextPoint)/60/60))
            if nextPoint == 0:
                os.system('sudo poweroff')
                time.sleep(10)
            time.sleep(nextPoint)
        except Exception as e:
            print e.message
            print e
            time.sleep(10)

if __name__ == '__main__':
    main()