# Smart Canvas

A smart canvas with math calculator. It still in progresses a lot can be done like enhance the model,...etc.
<hr>

# Structure

The tool can be split up to

- Frontend
- Worker Queue
- Backend

## Frontend

React application using vite. The main component is a canvas. Canvas is handled by a custom canvas called `useCanvss`
all the logic is done there. It returns [canvasRef,api]. The ref must be used in the desired canvas.

The api allow to update the canvas state, add text, start erasing mode,...etc.

It connects to the backend through a websocket to make the updates live.

The canvas automatically fires a callback on Idle when the canvas was idle for 3 seconds. We send our image to the
backend in this callback.

#### Extraction

Extracting only the shapes from the canvas can be tricky. So the solution was to have all shapes in a list and
empty it on every fire.

Using these shapes, we can create a small hidden canvas with the required size and convert it to a picture and send it
directly to the backend via the websocket.

> **NOTE**: `useCanvas` hook has two lists a list contains all drawings, and another one contains only shapes from idle
> to idle. The first one was made to redraw the canvas to support the infinite canvas.

## Backend

Not a fancy backend, just A django backend channel based to support websockets. The connection is opened once the
frontend is opened, to make sending and receiving as smooth as possible. When an image is received it will be sent to
the worker queue with an assigned `task_id`. To track the task.

## Worker Queue

As expected, the model can take time to find a solution. So, It was a must to make the model working in another process.
Here comes [celery](https://docs.celeryq.dev/en/stable/), A task queue distributed system using rabbitmq to manage
tasks.

Once the Worker queue received the task it will be sent to `PredictManager` to be evaluated. But how we send back to the
user?

- Django channels is so powerful at this point. Using ChannelsRedis, channel layers can be distributed among any number
  of instances.
- By sending the channel name to the queue and using `get_channel_layer().send(channel_name, event)`, the event will be
  transmitted to the specified channel. The sent data is then received on the other side and can be forwarded directly
  to the user.

<hr>

# How does it work?

For developing purposes, I decided to make my own CNN model. You can find the actual mode
at `backend/actual_model/model.py`.

The model itself can detect numbers, characters, and math operations. When an image is given. The `PredictManager` uses
opencv2 to extract contours then sort them twice. The first one from left to right using `imutils` functionality that
helps to detect things like equal,...etc, secondly another sorting algorithm that make sures the output features are in
a proper order to be calculated.

## The main sort

I developed the main sort algorithm to make sure I get always the right feature specially with more than one equation
.It goes by two steps:

- Sort all extracted features on the y-axis (That will be eaiser to put them in the right position).
- Using a parameter threshold we can determine what is the height of a row (default is 100)
- Then sort the extracted row on the x axis.

## Actual Solving

Once all features are extracted, they are passed to the model for evaluation. The system includes a fully implemented
solver, which handles the following tasks:

1. **Tokenization**: The extracted results are tokenized into manageable components.
2. **AST Construction:** These tokens are then structured into an Abstract Syntax Tree (AST) to represent the logical
   operations.
3. **Evaluation**: The AST is evaluated to compute the final values.

The result then returns to the GUI.

## Training

I used this [dataset](https://www.kaggle.com/datasets/xainano/handwrittenmathsymbols) which provides more than 83 label.
I didn't use all these labels I reduced them to 75 because it contains labels with more than one character which will be
useless to our case as we extract character by character.

The model was made with PyTorch with:

- Transform:

```python
transforms.Compose([
    transforms.Grayscale(),
    ThresholdTransform(),
    # Apply before ToTensor
    transforms.Resize((128, 128), interpolation=InterpolationMode.NEAREST),
    # transforms.RandomRotation(degrees=5),  # Rotate before ToTensor for less overhead
    transforms.GaussianBlur((1, 1), sigma=1),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5], std=[0.5]),
])
```

- Adam Optimizer with learning rate `0.001` and `ReduceLROnPlateau` as scheduler.
- Early stopper with patience 3.
- The tested models were eight epochs only. (My GPU couldn't handle anymore) but was with validation accuracy `99%`
- If your handwriting is good it will get the results accurate (tested with couple of my friends)

<hr>

<details>
<summary>Demo</summary>



https://github.com/user-attachments/assets/a855a0c5-57bf-4282-a8d5-b5a875ab83a4


</details>

# Important

This repo in progress. I just decided to write things now because I like the current state.
If you ever want to contribute, have an issue; ...etc. You are welcome
