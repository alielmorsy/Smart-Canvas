import React, {useCallback, useEffect, useMemo, useRef, useState, useTransition} from "react";
import {clsx} from "clsx";
import useCanvas from "./useCanvas.tsx";
import ToolBar from "./toolBar.tsx";
import {FaPaintbrush} from "react-icons/fa6";
import {LuGrab} from "react-icons/lu";
import {BackendResponse, CanvasProps, NewCanvasInfo} from "./types";
import useWebSocket from "react-use-websocket";
import Extractor from "./extractImage.ts";

const Circle = ({size = 300}) => (
    <div
        style={{
            width: `${size}px`,
            height: `${size}px`,
        }}
        className={"fixed border-2 border-red-600  rounded-full"}
    />
);


export enum CursorType {
    None = 0,
    PEN,
    GRAB = 2,
    ERASE,

}

const MessageList: React.FC<{ messages: string[] }> = React.memo(({messages}) => (
    <div
        className="absolute top-1 left-1 bg-gray-600 text-gray-200 rounded-md z-10 text-sm py-3 px-1 min-w-64 h-64 overflow-scroll flex flex-col items-start">
        {messages.map((value, index) => <span key={index}> {value}</span>)}
    </div>
));

interface PositionsRef {
    tasId: string,
    info: NewCanvasInfo
}

const Canvas: React.FC<CanvasProps> = ({className}) => {
    const [isOpen, setIsOpen] = useState(false)
    const {sendJsonMessage, lastJsonMessage} = useWebSocket("ws://127.0.0.1:8000/ws/", {
        retryOnError: true,
        onOpen: (e) => setIsOpen(true),
        shouldReconnect: (e) => true,
        onClose: (e) => setIsOpen(false),
        onError: (e) => setMessages([...messages, "Failed to connect"])

    })
    const [position, setPosition] = useState({x: 0, y: 0});
    const [ref, api] = useCanvas({});
    const [isGrabbing, setIsGrabbing] = useState<boolean>(false);
    const [isPending, startTransition] = useTransition();
    const [cursorType, setCursorType] = useState(CursorType.PEN);
    const lastCursorRef = useRef(CursorType.PEN);
    const eraseSizeRef = useRef(0)
    const [messages, setMessages] = useState<string[]>([])

    const lastPositionRef = useRef<NewCanvasInfo>()

    const positionsRef = useRef<Record<string, NewCanvasInfo>>({})
    api.onIdle((e) => {

        console.log(e)
        const [image, newCanvasInfo] = Extractor(e)
        lastPositionRef.current = newCanvasInfo
        sendJsonMessage({action: "submit_image", image: image})

    })
    useEffect(() => {
        if (!lastJsonMessage) return
        const response: BackendResponse = lastJsonMessage
        console.log(lastJsonMessage)
        const event = lastJsonMessage.event
        if (event === "task_added") {
            positionsRef.current[response.task_id] = lastPositionRef.current!

        } else if (event === "solution") {
            const position = response.position!
            const taskId = response.task_id!
            const info = positionsRef.current![taskId]
            position.x += info.minX
            position.y += info.minY
            api.putText(response.value!, position)
        } else if (event === "done") {
            const taskId = response.task_id!
            delete positionsRef.current[taskId]
        }
        setMessages([...messages, lastJsonMessage.message])
    }, [lastJsonMessage]);
    const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        setPosition({x: e.clientX, y: e.clientY});

        if (api.isGrabbing() && cursorType !== CursorType.GRAB) {
            startTransition(() => setCursorType(CursorType.GRAB));
        } else if (!api.isGrabbing() && cursorType === CursorType.GRAB) {
            startTransition(() => setCursorType(lastCursorRef.current));
        }
    }, [api, cursorType]);
    const cursor = useMemo(() => {
        switch (cursorType) {
            case CursorType.None:
                return null;
            case CursorType.PEN:
                return <FaPaintbrush/>;
            case CursorType.GRAB:
                return <LuGrab/>;
            case CursorType.ERASE:
                return <Circle size={eraseSizeRef.current}/>;
            default:
                return null;
        }
    }, [cursorType]);
    const resetMouse = () => {
        setCursorType(lastCursorRef.current);
    };
    const onCursorChange = (type, options) => {
        let currentCursor = lastCursorRef.current
        if (type === "brush") {
            api.setEraser(false)
            currentCursor = CursorType.PEN
        } else if (type === "eraser") {
            currentCursor = CursorType.ERASE
            api.setEraser(true)
            eraseSizeRef.current = options.size
            api.setEraserSize(options.size!)
        } else if (type === "clear") {
            api.clear()
        }
        startTransition(() => setCursorType(currentCursor))
        lastCursorRef.current = currentCursor
    }

    return (
        <>
            {!isOpen &&
                <div className="opacity-70 fixed inset-0 z-40 bg-black flex text-center items-center justify-center">
                    <span className={"text-white text-3xl"}>Connecting...</span>
                </div>}
            <div
                className={clsx("relative overflow-hidden h-screen w-screen", className!)}>
                <ToolBar onOptionChange={onCursorChange}/>
                <canvas
                    onMouseEnter={resetMouse}
                    onMouseDown={resetMouse}
                    onMouseMove={onMouseMove}
                    onMouseLeave={() => setCursorType(CursorType.None)}
                    ref={ref}
                    className={"w-full h-full cursor-none"}
                />
                <MessageList messages={messages}/>
                {cursor && (
                    <span
                        style={{
                            position: "absolute",
                            top: `${position.y}px`,
                            left: `${position.x}px`,
                            pointerEvents: "none", // Make sure the icon doesn’t interfere with other elements
                            fontSize: "19px", // Adjust the size of the icon
                            color: "gray", // Customize icon color
                            transform: "translate(-5%, -65%)", // Center the icon on the cursor
                        }}
                    >
          {cursor}
        </span>
                )}
            </div>
        </>
    );
};
export default Canvas;
