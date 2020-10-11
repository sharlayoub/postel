import * as React from "react";
import { Placement, State, Action, Props, PlacementWithoutAuto } from "../..";
import Portal from "./Portal";
import TransparentUnderlay from "./TransparentUnderlay";

const initialState: State = {
  isMounting: false,
  isIdle: false,
  isVisible: false,
  isFocused: false,
  isLeaving: false,
  isDismissed: false,
  isTransitioningOut: false,
};

export default function Postel(props: Props) {
  const timeout = React.useRef<any>(null);
  const toggleRef = React.useRef<HTMLElement | undefined>(undefined);
  const contentRef = React.useRef<HTMLElement | undefined>(undefined);
  const caretRef = React.useRef<HTMLElement | undefined>(undefined);
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const [, forceRender] = React.useState({});

  React.useEffect(() => {
    function handleReposition() {
      forceRender({});
    }
    window.addEventListener("wheel", handleReposition);
    return () => {
      window.removeEventListener("wheel", handleReposition);
    };
  }, [state.isVisible]);

  const trigger = props.trigger || "hover";
  const triggerDelay = props.triggerDelay || 0;
  const hideTrigger = props.hideTrigger || "mouseleave";
  const hideDelay = props.hideDelay || 0;
  const transitionOutMs = props.transitionOutMs || 0;

  const withLeaveTransition = React.useCallback(
    (callback: () => void, duration = 0) => {
      clearTimeout(timeout.current);

      if (duration) {
        dispatch({
          type: "TRANSITION_OUT_START",
        });

        timeout.current = setTimeout(() => {
          clearTimeout(timeout.current);

          dispatch({
            type: "TRANSITION_OUT_COMPLETE",
          });

          callback();
        }, duration);
      } else {
        callback();
      }
    },
    []
  );

  // Generic delay handler.
  const withDelay = React.useCallback((callback: () => void, delay = 0) => {
    clearTimeout(timeout.current);

    if (delay) {
      timeout.current = setTimeout(() => {
        clearTimeout(timeout.current);

        callback();
      }, delay);
    } else {
      callback();
    }
  }, []);

  // Delays showing the tip.
  const withTriggerDelay = React.useCallback(
    (callback: () => void, delay = 0) => {
      clearTimeout(timeout.current);

      if (state.isVisible && !state.isTransitioningOut) {
        return;
      }

      withDelay(callback, delay);
    },
    [state.isVisible, state.isTransitioningOut, withDelay]
  );

  const handleHide = React.useCallback(() => {
    withDelay(() => {
      withLeaveTransition(() => {
        dispatch({
          type: "TRIGGER_HIDE",
        });
      }, transitionOutMs);
    }, hideDelay);
  }, [withDelay, withLeaveTransition, transitionOutMs, hideDelay]);

  // Callback we're gonna give to the user – no need for withDelay here as
  // we'd rather have the UI react immediately when this is called.
  const onRequestClose = React.useCallback(() => {
    withLeaveTransition(() => {
      dispatch({
        type: "TRIGGER_HIDE",
      });
    }, transitionOutMs);
  }, [transitionOutMs, withLeaveTransition]);

  React.useEffect(() => {
    const _state = {
      count: 0,
      tolerance: 150,
    }
    const toggle = toggleRef.current;
    const content = contentRef.current;

    // Trigger handlers.
    function handleMouseEnter() {
      withTriggerDelay(() => {
        if (state.isTransitioningOut) {
          clearTimeout(timeout.current);
          dispatch({
            type: "CANCEL_TRANSITIONING_OUT",
          });
        } else {
          _state.count += 1;
          dispatch({
            type: "TRIGGER_SHOW",
          });
        }
      }, triggerDelay);
    }

    function handleClick(event: MouseEvent) {
      event.preventDefault();
      event.stopPropagation();

      withTriggerDelay(() => {
        if (state.isTransitioningOut) {
          clearTimeout(timeout.current);
          dispatch({
            type: "CANCEL_TRANSITIONING_OUT",
          });
        } else {
          dispatch({
            type: "TRIGGER_SHOW",
          });
        }
      }, triggerDelay);
    }

    // Hide handlers.
    function handleMouseLeave() {
      _state.count--;
      setTimeout(() => {
        if (_state.count) {
          handleHide();
        }
      }, _state.tolerance);
    }

    function handleContentMouseEnter() {
      _state.count += 1;
    }

    function handleOuterClick(event: MouseEvent) {
      const target = event.target as Node;
      const content = contentRef.current;
      const toggle = toggleRef.current;
      const caret = caretRef.current;

      if (
        content?.contains(target) ||
        toggle?.contains(target) ||
        caret?.contains(target)
      ) {
        return;
      }

      handleHide();
    }

    // Setup listeners
    if (trigger === "hover") {
      content?.addEventListener("mouseenter", handleContentMouseEnter);
      toggle?.addEventListener("mouseenter", handleMouseEnter);
    }

    if (trigger === "click") {
      toggle?.addEventListener("click", handleClick);
    }

    if (trigger === "mousedown") {
      toggle?.addEventListener("mousedown", handleClick);
    }

    if (hideTrigger === "mouseleave") {
      content?.addEventListener("mouseleave", handleMouseLeave);
      toggle?.addEventListener("mouseleave", handleMouseLeave);
    }

    if (hideTrigger === "click") {
      window.addEventListener("click", handleOuterClick);
    }

    return () => {
      content?.removeEventListener("mouseleave", handleMouseLeave);
      content?.removeEventListener("mouseenter", handleContentMouseEnter);
      toggle?.removeEventListener("mouseenter", handleMouseEnter);
      toggle?.removeEventListener("mouseleave", handleMouseLeave);
      toggle?.removeEventListener("click", handleClick);
      toggle?.removeEventListener("mousedown", handleClick);
      window.removeEventListener("click", handleOuterClick);
    };
  }, [
    state.isVisible,
    state.isTransitioningOut,
    trigger,
    triggerDelay,
    hideTrigger,
    transitionOutMs,
    withLeaveTransition,
    withTriggerDelay,
    withDelay,
    handleHide,
  ]);

  const handlePortalMounted = React.useCallback(() => {
    dispatch({
      type: "PORTAL_MOUNTED",
    });
  }, []);

  function getStyles(
    isVisible: boolean,
    type: "content" | "caret",
    placement: Placement,
    preferredAutoPlacement?: PlacementWithoutAuto,
    verticalOffset: number = 0,
    horizontalOffset: number = 0
  ) {
    const defaultStyles = {
      position: "absolute" as any, // Typescript sees "absolute" as a plain string.
      top: 0,
      left: 0,
      transform: `translate3d(0px, 0px, 0px)`,
      zIndex: 81,
    };

    const content = contentRef.current;
    const toggle = toggleRef.current;
    const caret = caretRef.current;

    if (!isVisible || !content) {
      if (type === "content") {
        return {
          style: {
            ...defaultStyles,
            visibility: "hidden" as any, // Typescript sees "hidden" as a plain string.
          },
        };
      }
      if (type === "caret") {
        return {
          style: {
            ...defaultStyles,
            visibility: "hidden",
            transform: `translate3d(0px, 0px, 0px) rotate(45deg)`, // Default 45deg because we'll need to calculate the width when it's in the shape of a triangle.
          },
        };
      }
    }

    if (content && toggle) {
      const position = getPosition(
        content,
        toggle,
        caret,
        placement,
        preferredAutoPlacement,
        verticalOffset,
        horizontalOffset
      );

      if (type === "content") {
        return {
          style: {
            ...defaultStyles,
            transform: `translate3d(${position.content.left}px, ${position.content.top}px, 0px)`,
          },
        };
      }

      if (type === "caret") {
        return {
          style: {
            ...defaultStyles,
            transformOrigin: position.caret.transform.origin,
            transform: `translate3d(${position.caret.left}px, ${position.caret.top}px, 0px) rotate(${position.caret.transform.rotate})`,
          },
        };
      }
    }
  }

  function mapPropsAndRefsToChildren(
    child: React.ReactNode,
    ref: React.Ref<React.ReactNode>,
    props?: Object
  ) {
    return React.cloneElement(child as React.ReactElement<any>, {
      ref,
      ...props,
    });
  }

  const placement = props.placement || "auto";

  const childProps = {
    isTransitioningOut: state.isTransitioningOut,
    onRequestClose,
  };

  return (
    <>
      {mapPropsAndRefsToChildren(props.children, toggleRef)}

      {(state.isVisible || state.isMounting) && props.content && (
        <Portal onReady={handlePortalMounted}>
          {state.isVisible &&
            !state.isTransitioningOut &&
            props.showTransparentUnderlay && <TransparentUnderlay />}
          <div
            {...getStyles(
              state.isVisible,
              "content",
              placement,
              props.preferredAutoPlacement,
              props.verticalOffset,
              props.horizontalOffset
            )}
          >
            {mapPropsAndRefsToChildren(
              typeof props.content === "function"
                ? props.content(childProps)
                : props.content,
              contentRef
            )}
          </div>
          {props.caret && (
            <div
              {...getStyles(
                state.isVisible,
                "caret",
                placement,
                props.preferredAutoPlacement,
                props.verticalOffset,
                props.horizontalOffset
              )}
            >
              {mapPropsAndRefsToChildren(
                typeof props.caret === "function"
                  ? props.caret(childProps)
                  : props.caret,
                caretRef
              )}
            </div>
          )}
        </Portal>
      )}
    </>
  );
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "CANCEL_TRANSITIONING_OUT": {
      return {
        ...state,
        isTransitioningOut: false,
      };
    }

    case "TRIGGER_SHOW": {
      return {
        isMounting: true,
        isIdle: false,
        isFocused: false,
        isLeaving: false,
        isDismissed: false,
        isVisible: false,
        isTransitioningOut: false,
      };
    }

    case "PORTAL_MOUNTED": {
      return {
        isMounting: false,
        isIdle: false,
        isFocused: false,
        isLeaving: false,
        isDismissed: false,
        isVisible: true,
        isTransitioningOut: false,
      };
    }

    case "TRANSITION_OUT_START": {
      return {
        ...state,
        isTransitioningOut: true,
      };
    }

    case "TRANSITION_OUT_COMPLETE": {
      return {
        ...state,
        isTransitioningOut: false,
      };
    }

    case "TRIGGER_HIDE": {
      return {
        isMounting: false,
        isIdle: false,
        isFocused: false,
        isLeaving: false,
        isDismissed: true,
        isVisible: false,
        isTransitioningOut: false,
      };
    }

    default:
      return state;
  }
}

/**
 * Helpers
 * =======
 */

function getPosition(
  content: HTMLElement,
  toggle: HTMLElement,
  caret?: HTMLElement,
  preferredPlacement: Placement = "auto",
  preferredAutoPlacement?: PlacementWithoutAuto,
  verticalOffset: number = 0,
  horizontalOffset: number = 0
): {
  content: { top: number; left: number };
  caret: {
    top: number;
    left: number;
    transform: {
      origin: string;
      rotate: string;
    };
  };
} {
  const contentRect = getOffset(content);
  const toggleRect = getOffset(toggle);
  const caretRect = caret ? getOffset(caret) : emptyOffset;
  const boundingRect = getOffset(document.documentElement);

  const top =
    toggleRect.top -
    contentRect.height -
    caretRect.height * 0.5 +
    verticalOffset;
  const bottom =
    toggleRect.top +
    toggleRect.height +
    caretRect.height * 0.5 -
    verticalOffset;
  const start = toggleRect.left;
  const end = toggleRect.left + toggleRect.width - contentRect.width;
  const center =
    toggleRect.left + toggleRect.width * 0.5 - contentRect.width * 0.5;
  const verticalCenter =
    toggleRect.top + toggleRect.height * 0.5 - contentRect.height * 0.5;
  const left =
    toggleRect.left -
    contentRect.width -
    caretRect.width * 0.5 +
    1 + // 1px offset just looks better
    horizontalOffset;
  const right =
    toggleRect.left +
    toggleRect.width +
    caretRect.width * 0.5 -
    1 - // -1px offset just looks better
    horizontalOffset;

  let placement: Placement = preferredPlacement;

  if (preferredPlacement === "auto") {
    // Default
    placement = preferredAutoPlacement || "top";

    // No room on top
    if (top < boundingRect.scrollY && placement) {
      if (placement === "top-start") {
        placement = "bottom-start";
      }
      if (placement === "bottom-start") {
        placement = "top-start";
      }
      if (placement === "top") {
        placement = "bottom";
      }
    }

    // No room on bottom
    if (
      bottom + contentRect.height - boundingRect.scrollY >
      window.innerHeight
    ) {
      if (placement === "bottom-start") {
        placement = "top-start";
      }
      if (placement === "bottom-end") {
        placement = "top-end";
      }
      if (placement === "bottom") {
        placement = "top";
      }
    }

    if (placement.includes("start") || placement.includes("end")) {
      if (
        toggleRect.left + contentRect.width >
          boundingRect.width + boundingRect.scrollX ||
        toggleRect.left < boundingRect.scrollX
      ) {
        placement = placement.split("-")[0] as Placement;
      }
    }

    if (placement === "top" || placement === "bottom") {
      const centerWithHorizontalScroll = center - boundingRect.scrollX;
      // No room on the left, but room on the right.
      if (
        centerWithHorizontalScroll < boundingRect.left &&
        centerWithHorizontalScroll + contentRect.width <= boundingRect.width
      ) {
        placement = placement.concat("-start") as Placement;
      } else if (
        // No room on the right, but room on the left.
        centerWithHorizontalScroll + contentRect.width > boundingRect.width &&
        centerWithHorizontalScroll >= boundingRect.left
      ) {
        placement = placement.concat("-end") as Placement;
      }
    }

    if (placement === "left") {
      if (
        toggleRect.left - caretRect.width - contentRect.width <
          boundingRect.scrollX &&
        toggleRect.left +
          toggleRect.width +
          caretRect.width +
          contentRect.width <
          boundingRect.width + boundingRect.scrollX
      ) {
        placement = "right";
      }
    }

    if (placement === "right") {
      if (
        toggleRect.left +
          toggleRect.width +
          caretRect.width +
          contentRect.width >
          boundingRect.width + boundingRect.scrollX &&
        left - contentRect.width + caretRect.width > toggleRect.scrollX
      ) {
        placement = "left";
      }
    }
  }

  const toggleHorizontalCenter = toggleRect.left + toggleRect.width * 0.5;

  const topCaret = {
    top: toggleRect.top - caretRect.height + verticalOffset,
    left: toggleHorizontalCenter,
    transform: {
      origin: "0 0",
      rotate: "45deg",
    },
  };
  const bottomCaret = {
    top: toggleRect.top + toggleRect.height - verticalOffset,
    left: toggleHorizontalCenter,
    transform: {
      origin: "30% 70%",
      rotate: "-135deg",
    },
  };

  const placements = {
    top: {
      content: { top, left: center },
      caret: topCaret,
    },
    bottom: {
      content: { top: bottom, left: center },
      caret: bottomCaret,
    },
    left: {
      content: { top: verticalCenter, left },
      caret: {
        top: toggleRect.top + toggleRect.height * 0.5,
        left: toggleRect.left - caretRect.width + horizontalOffset,
        transform: {
          origin: "0 0",
          rotate: "-45deg",
        },
      },
    },
    right: {
      content: { top: verticalCenter, left: right },
      caret: {
        top: toggleRect.top + toggleRect.height * 0.5,
        left: toggleRect.left + toggleRect.width - horizontalOffset,
        transform: {
          origin: "70% 30%",
          rotate: "135deg",
        },
      },
    },
    "top-start": {
      content: { top, left: start },
      caret: topCaret,
    },
    "top-end": {
      content: { top, left: end },
      caret: topCaret,
    },
    "bottom-start": {
      content: { top: bottom, left: start },
      caret: bottomCaret,
    },
    "bottom-end": {
      content: { top: bottom, left: end },
      caret: bottomCaret,
    },
  };

  return placements[placement];
}

const emptyOffset = {
  top: 0,
  left: 0,
  height: 0,
  width: 0,
  scrollY: 0,
  scrollX: 0,
};

// A cross browser way to get the position of an element relative to the document.
// Source: https://plainjs.com/javascript/styles/get-the-position-of-an-element-relative-to-the-document-24/
function getOffset(
  el: HTMLElement
): {
  top: number;
  left: number;
  height: number;
  width: number;
  scrollY: number;
  scrollX: number;
} {
  const rect = el.getBoundingClientRect(),
    scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
    scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  return {
    top: rect.top + scrollTop,
    left: rect.left + scrollLeft,
    height: rect.height,
    width: rect.width,
    scrollY: window.scrollY,
    scrollX: window.scrollX,
  };
}
