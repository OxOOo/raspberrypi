#encoding: utf-8

import strictyaml
import urllib, urllib2, re, json
import time
from aliyunsdkcore import client
from aliyunsdkalidns.request.v20150109 import DescribeDomainRecordsRequest, UpdateDomainRecordRequest

config = strictyaml.load(open('config.yml').read())
access_key = config['access_key']
access_key_secret = config['access_key_secret']
domain = config['domain']

def process():
    try:
        html = urllib2.urlopen('http://1212.ip138.com/ic.asp').read().decode('gb2312')
        myip = re.compile(r'\[([\.\d]+)\]').search(html).group(1).strip()
        print myip
    except:
        print '查询本地IP失败'
        return

    try:
        clt = client.AcsClient(access_key, access_key_secret, 'cn-hangzhou')
        request = DescribeDomainRecordsRequest.DescribeDomainRecordsRequest()
        request.set_accept_format('json')
        request.set_DomainName(domain)
        result = json.loads(clt.do_action(request))
        records = result['DomainRecords']['Record']

        for record in records:
            if record['Value'] == myip:
                continue
            request = UpdateDomainRecordRequest.UpdateDomainRecordRequest()
            request.set_accept_format('json')
            request.set_RR(record['RR'])
            request.set_RecordId(int(record['RecordId']))
            request.set_Value(myip)
            request.set_TTL(record['TTL'])
            request.set_Line(record['Line'])
            request.set_Type(record['Type'])
            result = clt.do_action(request)
            print result

    except Exception as e:
        print '修改域名失败'
        return
    print '修改成功'


def main():
    while True:
        process()
        time.sleep(10*60) # 10分钟

if __name__ == '__main__':
    main()