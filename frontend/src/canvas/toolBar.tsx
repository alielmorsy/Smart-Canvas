import React, {
    ChangeEvent,
    MouseEventHandler,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import {MdDragIndicator, MdOutlineRectangle} from "react-icons/md";
import {FaArrowRightLong, FaPaintbrush} from "react-icons/fa6";
import {FaEraser, FaTrash} from "react-icons/fa";
import {clsx} from "clsx";
import {IoIosColorPalette, IoMdRedo, IoMdUndo} from "react-icons/io";
import {ToolBarProps} from "./types";
import {AiOutlineClear} from "react-icons/ai";


const ToolBar: React.FC<ToolBarProps> = ({onOptionChange}) => {
    const [dragging, setDragging] = React.useState(false);
    const [position, setPosition] = useState<PositionProps>({
        left: ".6rem",
        top: "30%",
    });
    const [offset, setOffset] = useState({x: 0, y: 0});
    const [isColumn, setIsColumn] = React.useState(true);
    const divRef = useRef<HTMLDivElement | null>(null);
    const [isEraser, setIsEraser] = React.useState(false);

    const eraserSizeRef = useRef<HTMLInputElement | null>(null)
    useEffect(() => {
        if (dragging) {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        } else {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [dragging]);

    useEffect(() => {
        window.addEventListener("keydown", onKeyDown, true)
        return () => {
            window.removeEventListener("keydown", onKeyDown, true)
        }
    }, [])


    const onMouseDown = (event: React.MouseEvent) => {
        const rect = divRef.current?.getBoundingClientRect();
        setOffset({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        });
        setDragging(true);
    };
    const onMouseMove = (event: MouseEvent) => {
        if (!dragging) return;
        const top = event.clientY - offset.y;
        const left = event.clientX - offset.x;
        if (top < 5 || left < 5) {
            return;
        }
        setIsColumn(left < 20);
        setPosition({
            top: `${top}px`,
            left: `${left}px`,
        });
    };
    const onMouseUp = () => {
        setDragging(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "e") {
            setIsEraser(true)
        } else if (event.key === "p") {

        }
    }


    const onEvent = (event: React.MouseEvent<HTMLButtonElement>, what) => {
        setIsEraser(false)
        if (what === "brush") {
            onOptionChange("brush")
        } else if (what == "eraser") {
            setIsEraser(true)
            onOptionChange("eraser", {size: Number.parseFloat(eraserSizeRef.current?.value!)})
        } else if (what == "clear") {
            onOptionChange("clear")
        }

    }
    return (
        <div
            ref={divRef}
            className={clsx("absolute flex items-center", {
                "flex-row space-x-2": isColumn,
                "flex-col space-y-2": !isColumn,
            })}
            style={{
                left: position.left,
                top: position.top,
            }}
        >
            <div
                className={clsx(
                    " px-6 py-4 bg-zinc-700 rounded-lg shadow-xl flex items-center",
                    {
                        "flex-col  space-y-6": isColumn,
                        "space-x-6": !isColumn,
                    },
                )}
            >
                {/* Drag Handle */}
                <span onMouseDown={onMouseDown} onDragStart={() => false}>
          <MdDragIndicator
              className={clsx("text-gray-300 cursor-move text-2xl", {
                  "rotate-90": isColumn,
              })}
          />
        </span>

                {/* Icon Group */}
                <div
                    className={clsx("flex ", {
                        "flex-col space-y-4": isColumn,
                        "space-x-4": !isColumn,
                    })}
                >
                    <button onClick={(e) => onEvent(e, "brush")}>
                        <FaPaintbrush
                            className="text-gray-300 hover:text-white cursor-pointer transition-colors duration-200 text-xl"/>
                    </button>
                    <button onClick={(e) => onEvent(e, "eraser")}>
                        <FaEraser
                            className="text-gray-300 hover:text-white cursor-pointer transition-colors duration-200 text-xl"/>
                    </button>
                    <button onClick={(e) => onEvent(e, "clear")}>
                        <FaTrash
                            className="text-gray-300 hover:text-white cursor-pointer transition-colors duration-200 text-xl"/>
                    </button>
                    <div>
                        <IoIosColorPalette
                            className="text-gray-300 hover:text-white cursor-pointer transition-colors duration-200 text-xl"/>

                    </div>
                    <span
                        className={clsx("border-solid border-gray-100", {
                            "border-l-2 ": !isColumn,
                            "border-b-2 ": isColumn,
                        })}
                    ></span>
                    <button>
                        <IoMdUndo
                            className="text-gray-300 hover:text-white cursor-pointer transition-colors duration-200 text-xl"/>
                    </button>
                    <button>
                        <IoMdRedo
                            className="text-gray-300 hover:text-white cursor-pointer transition-colors duration-200 text-xl"/>
                    </button>
                </div>
            </div>
            <div
                className={clsx("px-6 py-4 bg-zinc-700 rounded-lg shadow-xl flex w-fit  h-fit transition-transform", {
                    "flex-col items-center space-y-6": isColumn,
                    "flex-row items-center  space-x-6": !isColumn,
                    "block": isEraser,
                    "hidden": !isEraser
                })}>
                <span className={"text-center text-gray-100 text-sm "}>Size</span>
                <input ref={eraserSizeRef} type={"range"} min={5} max={100} defaultValue={20}
                       onChange={(e) => onEvent(e, "eraser")}
                       className={clsx("w-40 h-2 bg-gray-300 rounded-lg transform ", {
                           'vertical-input-range': isColumn,
                           'w-[100px] h-1': !isColumn
                       })}/>

            </div>
        </div>
    );
};
export default ToolBar;
