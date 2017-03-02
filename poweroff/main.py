# encoding: utf-8

import alog
from datetime import datetime, timedelta, date
import os, time

def nextTimepoint():
    if datetime.now().weekday() == 4 or datetime.now().weekday() == 5: # 星期五和星期六
        n = datetime.now()
        t = date.today() + timedelta(days=1)
        return (datetime(t.year, t.month, t.day) - n).seconds + 5
    else:
        n = datetime.now()
        t = date.today()
        p = datetime(t.year, t.month, t.day, 22, 55)
        if p < n: return 0
        return (p - n).seconds + 5

def main():
    while True:
        nextPoint = nextTimepoint()
        alog.info('时间点(%d):%.2f 小时'%(nextPoint, float(nextPoint)/60/60))
        if nextPoint == 0:
            os.system('sudo poweroff')
            time.sleep(10)
        time.sleep(nextPoint)

if __name__ == '__main__':
    main()