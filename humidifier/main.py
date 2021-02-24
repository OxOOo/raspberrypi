
import RPi.GPIO as GPIO
import time, sys
import logging

LOG_FORMAT = "%(asctime)s - %(levelname)s - %(message)s"
logging.basicConfig(level=logging.DEBUG, format=LOG_FORMAT)

GPIO.setmode(GPIO.BOARD)
GPIO.setwarnings(False)

GPIO_PUMP_PIN = 40
GPIO_BUTTON_PIN = 38
GPIO_DEPTH_PIN = 36
GPIO_YELLOW_PIN = 33
GPIO_GREEN_PIN = 35
GPIO_RED_PIN = 37

GPIO.setup([
    GPIO_PUMP_PIN,
    GPIO_YELLOW_PIN,
    GPIO_GREEN_PIN,
    GPIO_RED_PIN], GPIO.OUT)
GPIO.setup([
    GPIO_BUTTON_PIN,
    GPIO_DEPTH_PIN], GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

# 初始化
GPIO.output(GPIO_PUMP_PIN, GPIO.HIGH)
GPIO.output([GPIO_YELLOW_PIN, GPIO_GREEN_PIN, GPIO_RED_PIN], GPIO.LOW)

"""
加水2分钟
"""
def run_pump():
    logging.info('Pumping')
    GPIO.output(GPIO_PUMP_PIN, GPIO.LOW)
    GPIO.output(GPIO_YELLOW_PIN, GPIO.HIGH)
    time.sleep(1 * 60)
    GPIO.output(GPIO_PUMP_PIN, GPIO.HIGH)
    GPIO.output(GPIO_YELLOW_PIN, GPIO.LOW)
    logging.info('Pump End')

"""
按钮检查，返回是否是want
会对want进行较为严格的检查
"""
def want_input(pin, want):
    if GPIO.input(pin) == want:
        s = 0
        for _ in range(10):
            if GPIO.input(pin) == want:
                s += 1
            time.sleep(0.1)
        if s > 7:
            return True
    return False

"""
depth_pin = 0表示低水位
button_pin = 0表示没有按下
"""
def main():
    ALL_LEDS = [GPIO_YELLOW_PIN, GPIO_GREEN_PIN, GPIO_YELLOW_PIN]
    GPIO.output(ALL_LEDS, GPIO.HIGH)
    time.sleep(1)
    GPIO.output(ALL_LEDS, GPIO.LOW)
    time.sleep(1)

    while True:
        time.sleep(0.1)
        GPIO.output(ALL_LEDS, GPIO.LOW)
        GPIO.output(GPIO_GREEN_PIN, GPIO.HIGH)

        if want_input(GPIO_DEPTH_PIN, 0): # 水低
            run_pump()
            if not want_input(GPIO_DEPTH_PIN, 1): # 加水不够
                logging.error('Not high enough')
                GPIO.output(ALL_LEDS, GPIO.LOW)
                GPIO.output(GPIO_RED_PIN, GPIO.HIGH)
                while True:
                    time.sleep(0.1)
                    if want_input(GPIO_BUTTON_PIN, 1):
                        run_pump()
                        break
        if want_input(GPIO_BUTTON_PIN, 1):
            run_pump()

if __name__ == '__main__':
    main()
