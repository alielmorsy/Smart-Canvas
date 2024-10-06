import json
import uuid

from channels.generic.websocket import AsyncWebsocketConsumer

from actual_model.predictManager import PredictManager
from solver_backend.tasks import predict


class FrontConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.variables = {}
        await self.accept()
        await self.send(text_data=json.dumps({
            "status": 0,
            'message': 'Welcome...',
        }))

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            await self.send(text_data=json.dumps({
                "status": -1,
                'message': 'Unknown command',
            }))
            return

        data = json.loads(text_data)
        action = data['action']

        if action == 'submit_image':
            image = data['image']

            # Trigger the image processing task
            task_id = str(uuid.uuid4())  # Generate unique task ID
            predict.apply_async((image, self.channel_name, self.variables, task_id))

            # Send an acknowledgment back to the user
            await self.send(text_data=json.dumps({
                "status": 0,
                "event": "task_added",
                'message': 'Starts Processing',
                'task_id': task_id
            }))

    async def message_event(self, event):
        message = event['message']
        # Send the message back to the WebSocket client
        await self.send(text_data=json.dumps({
            "status": 0,
            'message': message,
            'task_id': event["task_id"],
        }))

    async def done_event(self, event):
        self.variables.update(event["variables"])
        await self.send(text_data=json.dumps({
            "status": 0,
            "event": "done",
            **event

        }))

    async def error_event(self, event):
        err_code = event["error_code"]
        message = event["message"]
        task_id = event["task_id"]
        await self.send(text_data=json.dumps({
            "status": err_code,
            'message': message,
            'task_id': task_id
        }))

    async def calculation_event(self, event):
        await self.send(text_data=json.dumps({
            "status": 0,
            "event": "solution",
            **event
        }))
