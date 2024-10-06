import base64
import logging

import numpy as np
from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer

from actual_model import model
import cv2

from actual_model.predictManager import PredictManager


@shared_task
def load():
    logging.getLogger().info("Loading Model")
    from actual_model import model
    model.load_model()


channel_layer = get_channel_layer()


@shared_task(bind=True)
def predict(self, image, channel, variables, task_id):
    def send_message(msg):
        async_to_sync(channel_layer.send)(channel, {"type": "message_event", "message": msg, "task_id": task_id})

    def send_error(msg):
        async_to_sync(channel_layer.send)(channel,
                                          {"type": "error_event", "message": msg, "task_id": task_id, "error_code": -1})

    def on_done(message, variables):
        async_to_sync(channel_layer.send)(channel, {"type": "done_event", "message": message, "variables": variables,
                                                    "task_id": task_id})

    def on_calculation(value, position):
        async_to_sync(channel_layer.send)(channel,
                                          {"type": "calculation_event", "message": f"Calculated {value} at {position}",
                                           "value": value,
                                           "position": position,
                                           "task_id": task_id})

    manager = PredictManager(send_message, send_error, on_calculation, variables)
    on_done(str(manager.predict(image)), variables=variables)
