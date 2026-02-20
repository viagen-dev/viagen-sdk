import type { SVGProps } from "react";

export function ViagenLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="3.32 4.112 89.828 89.828"
      width="1em"
      height="1em"
      {...props}
    >
      <defs>
        <radialGradient
          gradientUnits="userSpaceOnUse"
          cx="178.98"
          cy="120.256"
          r="44.914"
          id="viagen-logo-gradient"
          gradientTransform="matrix(2.018294, -1.392162, 1.294219, 1.876303, -506.948639, 116.481866)"
        >
          <stop offset="0" stopColor="#0a0a0a" />
          <stop offset="1" stopColor="#0a0a0a" />
        </radialGradient>
      </defs>
      <g transform="matrix(1, 0, 0, 1, 0, 0)">
        <rect
          x="3.32"
          y="4.112"
          width="89.828"
          height="89.828"
          rx="8"
          ry="8"
          fill="#0a0a0a"
        />
        <path
          d="M 72.501 9.301 C 66.965 31.982 64.475 53.089 71.29 75.791 C 54.089 77.712 30.739 82.181 20.038 86.218 C 22.694 83.19 53.023 40.005 72.501 9.301 Z"
          fill="#f5f5f5"
          style={{ transformOrigin: "46.268px 47.758px 0px" }}
          transform="matrix(0.999326, 0.036701, -0.036701, 0.999326, 0, 0)"
        />
      </g>
    </svg>
  );
}
