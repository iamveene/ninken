"use client"

import { Handle, Position } from "@xyflow/react"

export function OperatorNode() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="operator-node-glow flex items-center justify-center rounded-full bg-red-600 border-2 border-red-500"
        style={{ width: 72, height: 72 }}
      >
        {/* Hacker/operator SVG icon */}
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Hood/head outline */}
          <path d="M12 2C8.5 2 5.5 4.5 5 8c-.3 2 .5 3.5 1.5 4.5" />
          <path d="M12 2c3.5 0 6.5 2.5 7 6 .3 2-.5 3.5-1.5 4.5" />
          {/* Face shadow */}
          <ellipse cx="12" cy="10" rx="4" ry="3.5" />
          {/* Eyes - terminal cursor style */}
          <rect x="9.5" y="9" width="2" height="1.5" rx="0.3" fill="white" stroke="none" />
          <rect x="12.5" y="9" width="2" height="1.5" rx="0.3" fill="white" stroke="none" />
          {/* Body/cloak */}
          <path d="M7 14c-1 1-2 3-2 5v1h14v-1c0-2-1-4-2-5" />
          {/* Keyboard/hands */}
          <path d="M8 18h8" />
          <path d="M9 20h6" />
        </svg>
      </div>
      <span className="text-[11px] font-bold text-red-400 tracking-wide uppercase">
        Operator
      </span>
      <Handle type="source" position={Position.Bottom} className="!bg-red-500 !border-red-400 !w-2 !h-2" />
    </div>
  )
}
