from django.urls import path

from . import consumers

websocket_urlpatterns = [
    path("ws/", consumers.FrontConsumer.as_asgi()),
]
