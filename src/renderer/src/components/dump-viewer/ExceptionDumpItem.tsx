// src/renderer/src/components/dump-viewer/ExceptionDumpItem.tsx

import { useState } from 'react'
import { Dump, Server } from '../../App'
import { ExceptionParser, type ParsedException } from '../../utils/exceptionParser'

interface ExceptionDumpItemProps {
  dump: Dump
  server: Server | undefined
  parsedException: ParsedException
  onOpenInIde: (file: string, line: number) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

const FRAMEWORK_STYLES = {
  laravel: {
    gradient: 'from-red-500 to-red-600',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 640 640"
        className={'w-10 h-10 fill-white stroke-2'}
      >
        <path d="M568.6 179.8C568.5 179.6 568.4 179.3 568.3 179.1C568.2 178.7 568 178.3 567.8 177.9C567.6 177.7 567.5 177.4 567.3 177.2C567.1 176.9 566.8 176.6 566.6 176.3C566.4 176.1 566.1 175.9 565.8 175.7C565.5 175.5 565.2 175.2 564.9 175L468.6 119.5C467.4 118.8 466 118.4 464.6 118.4C463.2 118.4 461.8 118.8 460.6 119.5L364.3 175C364 175.2 363.7 175.4 363.4 175.7C363.1 175.9 362.9 176.1 362.6 176.3C362.3 176.6 362.1 176.9 361.9 177.2C361.7 177.4 361.5 177.6 361.4 177.9C361.2 178.3 361 178.7 360.9 179.1C360.8 179.3 360.7 179.5 360.6 179.8C360.4 180.5 360.3 181.2 360.3 181.9L360.3 287.1L280.1 333.3L280.1 127.4C280.1 126.7 280 126 279.8 125.3C279.7 125.1 279.6 124.9 279.5 124.6C279.4 124.2 279.2 123.8 279 123.4C278.9 123.1 278.6 122.9 278.5 122.7C278.3 122.4 278 122.1 277.8 121.8C277.6 121.6 277.3 121.4 277 121.2C276.7 121 276.4 120.7 276.1 120.5L179.8 65.1C178.6 64.4 177.2 64 175.8 64C174.4 64 173 64.4 171.8 65.1L75.5 120.5C75.2 120.7 74.9 120.9 74.6 121.2C74.3 121.4 74.1 121.6 73.8 121.8C73.5 122.1 73.3 122.4 73.1 122.7C72.9 123 72.7 123.2 72.5 123.4C72.3 123.8 72.1 124.2 72 124.6C71.9 124.8 71.8 125 71.7 125.3C71.5 126 71.4 126.7 71.4 127.4L71.4 457.1C71.4 458.5 71.8 459.9 72.5 461.1C73.2 462.3 74.2 463.3 75.4 464L268 574.9C268.4 575.1 268.9 575.3 269.3 575.4C269.5 575.5 269.7 575.6 269.9 575.7C271.2 576.1 272.7 576.1 274 575.7C274.2 575.6 274.4 575.5 274.6 575.5C275.1 575.3 275.6 575.2 276 574.9L468.6 464.1C469.8 463.4 470.8 462.4 471.5 461.2C472.2 460 472.6 458.6 472.6 457.2L472.6 351.9L564.8 298.8C566 298.1 567 297.1 567.7 295.8C568.4 294.5 568.8 293.2 568.8 291.8L568.8 182C568.8 181.3 568.7 180.6 568.6 179.9zM175.8 81.3L256 127.4L175.8 173.6L95.6 127.4L175.8 81.2zM264 141.3L264 342.6C230.8 361.7 204.1 377.1 183.8 388.8L183.8 187.5C217 168.4 243.7 153 264 141.3zM264 554.1L87.5 452.5L87.5 141.3C107.8 153 134.6 168.4 167.7 187.5L167.7 402.7C167.7 403 167.8 403.3 167.8 403.6C167.8 404 167.9 404.4 168 404.8C168.1 405.1 168.2 405.4 168.4 405.7C168.5 406 168.7 406.4 168.8 406.7C169 407 169.2 407.2 169.4 407.5C169.6 407.8 169.8 408.1 170.1 408.3C170.3 408.5 170.6 408.7 170.9 408.9C171.2 409.1 171.5 409.4 171.8 409.6L264 461.8L264.1 554.2zM272 447.9L192 402.6C246.7 371.1 305.5 337.3 368.3 301.1L448.4 347.2C419 364 360.2 397.5 272 447.9zM456.5 452.5L280 554.1L280 461.8C381.4 404 440.2 370.4 456.5 361L456.5 452.4zM456.5 333.4C436.2 321.8 409.4 306.4 376.3 287.3L376.3 195.9C396.6 207.6 423.4 223 456.5 242.1L456.5 333.4zM464.5 228.1L384.3 181.9L464.5 135.7L544.7 181.8L464.5 228zM472.5 333.4L472.5 242.1C505.7 223 532.5 207.6 552.8 195.9L552.8 287.3L472.5 333.5z" />
      </svg>
    ),
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  },
  symfony: {
    gradient: 'from-gray-600 to-gray-700',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 640 640"
        className={'w-10 h-10 fill-black dark:fill-white stroke-2'}
      >
        <path d="M320 72C183 72 72 183 72 320C72 457 183 568 320 568C457 568 568 457 568 320C568 183 457 72 320 72zM453.7 215.5C442.2 215.9 434.3 209.1 433.9 198.6C433.6 189.4 440.6 185.2 440.4 179.7C440.2 173.2 430.2 172.9 427.5 173C387.7 174.3 378.9 230 368.6 286.8C390 290 405.2 286.1 413.7 280.6C425.7 272.9 410.4 264.9 412.3 256C416.3 237.8 444.9 237 444.3 261.3C443.9 279.2 418.4 303.1 366.7 297C355.9 356.5 348.3 412 308.5 458.7C279.5 493.2 250.1 498.5 236.9 499C212.3 499.9 195.9 486.7 195.3 469.2C194.7 452.2 209.7 442.9 219.6 442.6C241.5 441.8 249.7 468.3 234.5 476.6C222.4 486.3 234.6 489.2 236.6 489.2C247 488.8 253.9 483.7 258.8 480.2C282.8 460.2 292 425.3 304.2 361.9C312.4 312.2 321.2 283.9 322.4 279.9C305.5 267.2 295.3 251.3 272.6 245.2C257 241 247.5 244.6 240.8 253C232.9 263 235.5 276 243.2 283.7L255.8 297.7C271.3 315.6 279.8 329.6 276.6 348.3C271.5 378.2 235.9 401.2 193.7 388.2C157.7 377.1 151 351.6 155.3 337.6C162.8 313.4 197.7 325.9 189.9 351.2C187.1 359.8 185 359.9 183.6 364.3C179 379.1 225.4 392.7 234.6 362.9C239.1 348.4 229.3 341.2 212.4 323C183.9 291.3 196.4 257.5 215.3 243.3C268.1 203.9 315.8 260.8 325.9 269.1C363.1 160.1 426.4 163.6 428.3 163.6C453.5 162.8 472.5 174.2 473.1 192.2C473.3 199.9 468.9 214.8 453.6 215.3z" />
      </svg>
    ),
    badge: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
  },
  'vanilla-php': {
    gradient: 'from-indigo-500 to-indigo-600',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 640 640"
        className={'w-10 h-10 fill-black dark:fill-white stroke-2'}
      >
        <path d="M320 168.5C491.4 168.5 623.2 240.7 623.2 320C623.2 399.3 491.3 471.5 320 471.5C148.6 471.5 16.8 399.3 16.8 320C16.8 240.7 148.7 168.5 320 168.5zM320 151.7C143.3 151.7 0 227 0 320C0 413 143.3 488.3 320 488.3C496.7 488.3 640 413 640 320C640 227 496.7 151.7 320 151.7zM218.2 306.5C210.3 347 182.4 342.8 148.1 342.8L161.8 272.2C199.8 272.2 225.6 268.1 218.2 306.5zM97.4 414.3L134.1 414.3L142.8 369.5C183.9 369.5 209.4 372.5 233 350.4C259.1 326.4 265.9 283.7 247.3 262.3C237.6 251.1 222 245.6 200.8 245.6L130.1 245.6L97.4 414.3zM283.1 200.7L319.6 200.7L310.9 245.5C342.4 245.5 371.6 243.2 385.7 256.2C400.5 269.8 393.4 287.2 377.4 369.3L340.4 369.3C355.8 289.9 358.7 283.3 353.1 277.3C347.7 271.5 335.4 272.7 305.7 272.7L286.9 369.3L250.4 369.3L283.1 200.7zM505 306.5C497 347.6 468.3 342.8 434.9 342.8L448.6 272.2C486.8 272.2 512.4 268.1 505 306.5zM384.2 414.3L421 414.3L429.7 369.5C472.9 369.5 496.8 372 519.9 350.4C546 326.4 552.8 283.7 534.2 262.3C524.5 251.1 508.9 245.6 487.7 245.6L417 245.6L384.2 414.3z" />
      </svg>
    ),
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
  },
  node: {
    gradient: 'from-green-500 to-green-600',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 640 640"
        className={'w-10 h-10 fill-black dark:fill-white stroke-2'}
      >
        <path d="M320.5 572C313.8 572 307 570.2 301.1 566.8L239.4 530.3C230.2 525.1 234.7 523.3 237.7 522.3C250 518 252.5 517.1 265.6 509.6C267 508.8 268.8 509.1 270.2 510L317.6 538.1C319.3 539.1 321.7 539.1 323.3 538.1L508 431.5C509.7 430.5 510.8 428.5 510.8 426.5L510.8 213.3C510.8 211.2 509.7 209.3 507.9 208.2L323.3 101.7C321.6 100.7 319.3 100.7 317.6 101.7L133.1 208.3C131.3 209.3 130.2 211.3 130.2 213.4L130.2 426.5C130.2 428.5 131.3 430.5 133.1 431.4L183.7 460.6C211.2 474.3 228 458.2 228 441.9L228 231.5C228 228.5 230.4 226.2 233.4 226.2L256.8 226.2C259.7 226.2 262.2 228.5 262.2 231.5L262.2 442C262.2 478.6 242.2 499.6 207.5 499.6C196.8 499.6 188.4 499.6 165 488L116.6 460.1C104.6 453.2 97.2 440.3 97.2 426.4L97.2 213.3C97.2 199.5 104.6 186.5 116.6 179.6L301.1 73C312.8 66.4 328.3 66.4 339.9 73L524.6 179.7C536.6 186.6 544 199.5 544 213.4L544 426.5C544 440.3 536.6 453.2 524.6 460.2L339.9 566.8C334 570.2 327.3 572 320.5 572zM469.6 361.9C469.6 322 442.6 311.4 385.9 303.9C328.5 296.3 322.7 292.4 322.7 279C322.7 267.9 327.6 253.1 370.1 253.1C408 253.1 422 261.3 427.8 286.9C428.3 289.3 430.5 291.1 433 291.1L457 291.1C458.5 291.1 459.9 290.5 460.9 289.4C461.9 288.3 462.4 286.8 462.3 285.3C458.6 241.2 429.3 220.7 370.1 220.7C317.4 220.7 286 242.9 286 280.2C286 320.6 317.3 331.8 367.8 336.8C428.3 342.7 433 351.6 433 363.5C433 384.1 416.4 392.9 377.5 392.9C328.6 392.9 317.9 380.6 314.3 356.3C313.9 353.7 311.7 351.8 309 351.8L285.1 351.8C282.1 351.8 279.8 354.2 279.8 357.1C279.8 388.2 296.7 425.3 377.6 425.3C436 425.2 469.6 402.1 469.6 361.9z" />
      </svg>
    ),
    badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  },
  react: {
    gradient: 'from-blue-500 to-blue-600',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 640 640"
        className={'h-10 w-10 fill-black dark:fill-white stroke-2'}
      >
        <path d="M482.2 241.2C476.8 239.4 471.4 237.7 466 236.1C466.9 232.4 467.7 228.7 468.5 225C480.8 165.4 472.7 117.5 445.4 101.7C419.1 86.6 376.2 102.3 332.8 140.1C328.5 143.8 324.3 147.7 320.3 151.6C317.6 149 314.8 146.4 312 143.9C266.5 103.5 220.9 86.5 193.6 102.4C167.4 117.6 159.6 162.7 170.6 219.1C171.7 224.7 172.9 230.2 174.3 235.8C167.9 237.6 161.6 239.6 155.7 241.7C102.3 260.2 64 289.4 64 319.6C64 350.8 104.8 382.1 160.3 401.1C164.8 402.6 169.3 404.1 173.9 405.4C172.4 411.4 171.1 417.3 169.9 423.4C159.4 478.9 167.6 522.9 193.8 538C220.8 553.6 266.2 537.6 310.4 498.9C313.9 495.8 317.4 492.6 320.9 489.2C325.3 493.5 329.9 497.6 334.5 501.6C377.3 538.4 419.6 553.3 445.7 538.2C472.7 522.6 481.5 475.3 470.1 417.7C469.2 413.3 468.2 408.8 467.1 404.2C470.3 403.3 473.4 402.3 476.5 401.3C534.2 382.2 576 351.3 576 319.6C576 289.3 536.6 259.9 482.2 241.2zM346.9 156.3C384.1 123.9 418.8 111.2 434.6 120.3C451.5 130 458 169.2 447.4 220.7C446.7 224.1 446 227.4 445.1 230.7C422.9 225.7 400.4 222.1 377.8 220.1C364.8 201.5 350.6 183.7 335.2 167C339.1 163.3 342.9 159.8 346.9 156.3zM231.2 371.5C236.3 380.2 241.5 388.9 247 397.4C231.4 395.7 215.9 393.2 200.6 389.9C205 375.5 210.5 360.6 216.9 345.4C221.5 354.2 226.2 362.9 231.2 371.5zM200.9 251.2C215.3 248 230.6 245.4 246.5 243.4C241.2 251.7 236 260.2 231.1 268.8C226.2 277.3 221.4 286 216.9 294.8C210.6 279.9 205.3 265.3 200.9 251.2zM228.3 320.1C234.9 306.3 242.1 292.8 249.7 279.5C257.3 266.2 265.5 253.3 274.1 240.6C289.1 239.5 304.4 238.9 320 238.9C335.6 238.9 351 239.5 365.9 240.6C374.4 253.2 382.5 266.1 390.2 279.3C397.9 292.5 405.1 306 411.9 319.7C405.2 333.5 398 347.1 390.3 360.5C382.7 373.8 374.6 386.7 366.1 399.5C351.2 400.6 335.7 401.1 320 401.1C304.3 401.1 289.1 400.6 274.4 399.7C265.7 387 257.5 374 249.8 360.7C242.1 347.4 235 333.9 228.3 320.1zM408.9 371.3C414 362.5 418.8 353.6 423.5 344.6C429.9 359.1 435.5 373.8 440.4 388.9C424.9 392.4 409.2 395.1 393.4 396.9C398.8 388.5 403.9 379.9 408.9 371.3zM423.3 294.8C418.6 286 413.8 277.2 408.8 268.6C403.9 260.1 398.8 251.7 393.5 243.4C409.6 245.4 425 248.1 439.4 251.4C434.8 266.2 429.4 280.6 423.3 294.8zM320.2 182.3C330.7 193.7 340.6 205.7 349.8 218.1C330 217.2 310.1 217.2 290.3 218.1C300.1 205.2 310.2 193.2 320.2 182.3zM204.2 121C221 111.2 258.3 125.2 297.6 160C300.1 162.2 302.6 164.6 305.2 167C289.7 183.7 275.4 201.5 262.3 220.1C239.7 222.1 217.3 225.6 195.1 230.5C193.8 225.4 192.7 220.2 191.6 215C182.2 166.6 188.4 130.1 204.2 121zM179.7 384.6C175.5 383.4 171.4 382.1 167.3 380.7C146 374 121.8 363.4 104.3 349.5C94.2 342.5 87.4 331.7 85.5 319.6C85.5 301.3 117.1 277.9 162.7 262C168.4 260 174.2 258.2 180 256.5C186.8 278.2 195 299.5 204.5 320.1C194.9 341 186.6 362.6 179.7 384.6zM296.3 482.6C279.8 497.7 260.7 509.7 239.9 517.9C228.8 523.2 216 523.7 204.6 519.2C188.7 510 182.1 474.7 191.1 427.2C192.2 421.6 193.4 416 194.8 410.5C217.2 415.3 239.8 418.6 262.7 420.3C275.9 439 290.4 456.9 305.9 473.7C302.7 476.8 299.5 479.8 296.3 482.6zM320.8 458.3C310.6 447.3 300.4 435.1 290.5 422C300.1 422.4 310 422.6 320 422.6C330.3 422.6 340.4 422.4 350.4 421.9C341.2 434.6 331.3 446.7 320.8 458.3zM451.5 488.3C450.6 500.5 444.6 511.9 435 519.6C419.1 528.8 385.2 516.8 348.6 485.4C344.4 481.8 340.2 477.9 335.9 473.9C351.2 457 365.3 439.1 378.1 420.3C401 418.4 423.8 414.9 446.3 409.8C447.3 413.9 448.2 418 449 422C453.9 443.6 454.7 466.1 451.5 488.3zM469.7 380.8C466.9 381.7 464.1 382.6 461.2 383.4C454.2 361.6 445.6 340.3 435.7 319.6C445.3 299.2 453.4 278.2 460.2 256.7C465.4 258.2 470.4 259.8 475.2 261.4C521.8 277.4 554.5 301.2 554.5 319.4C554.5 339 519.6 364.3 469.7 380.8zM320 365.8C345.3 365.8 365.8 345.3 365.8 320C365.8 294.7 345.3 274.2 320 274.2C294.7 274.2 274.2 294.7 274.2 320C274.2 345.3 294.7 365.8 320 365.8z" />
      </svg>
    ),
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
  },
  vue: {
    gradient: 'from-emerald-500 to-emerald-600',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 640 640"
        className={'h-10 w-10 fill-black dark:fill-white stroke-2'}
      >
        <path d="M452.9 128.3L376 128.3L320 216.9L272 128.3L96 128.3L320 512L544 128.3L452.9 128.3zM151.7 160.3L205.5 160.3L320 358.5L434.4 160.3L488.2 160.3L320 448.5L151.7 160.3z" />
      </svg>
    ),
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
  },
  alpine: {
    gradient: 'from-teal-500 to-teal-600',
    icon: '⛰️',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400'
  },
  'vanilla-js': {
    gradient: 'from-yellow-500 to-yellow-600',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 640 640"
        className={'h-10 w-10 fill-black dark:fill-white stroke-2'}
      >
        <path d="M96 96L96 544L544 544L544 96L96 96zM339.8 445.4C339.8 489 314.2 508.9 276.9 508.9C243.2 508.9 223.7 491.5 213.7 470.4L248 449.7C254.6 461.4 260.6 471.3 275.1 471.3C288.9 471.3 297.7 465.9 297.7 444.8L297.7 301.7L339.8 301.7L339.8 445.4zM439.4 508.9C400.3 508.9 375 490.3 362.7 465.9L397 446.1C406 460.8 417.8 471.7 438.5 471.7C455.9 471.7 467.1 463 467.1 450.9C467.1 436.5 455.7 431.4 436.4 422.9L425.9 418.4C395.5 405.5 375.4 389.2 375.4 354.9C375.4 323.3 399.5 299.3 437 299.3C463.8 299.3 483 308.6 496.8 333L464 354C456.8 341.1 449 336 436.9 336C424.6 336 416.8 343.8 416.8 354C416.8 366.6 424.6 371.7 442.7 379.6L453.2 384.1C489 399.4 509.1 415.1 509.1 450.3C509.1 488.1 479.3 508.9 439.4 508.9z" />
      </svg>
    ),
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  }
}

export function ExceptionDumpItem({
  dump,
  server,
  parsedException,
  onOpenInIde,
  isExpanded,
  onToggleExpand
}: ExceptionDumpItemProps) {
  const [activeTab, setActiveTab] = useState<'stacktrace' | 'context' | 'solutions'>('stacktrace')
  const [expandedFrames, setExpandedFrames] = useState<Set<number>>(new Set([0]))

  const frameworkStyle =
    FRAMEWORK_STYLES[parsedException.framework || 'vanilla-js'] || FRAMEWORK_STYLES['vanilla-js']

  const toggleFrame = (index: number) => {
    setExpandedFrames((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)

    if (diffSecs < 60) return `${diffSecs}s ago`
    if (diffMins < 60) return `${diffMins}m ago`

    return date.toLocaleTimeString()
  }

  return (
    <div className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Exception Header */}
      <div
        className={`bg-gradient-to-r ${frameworkStyle.gradient} text-white p-4 cursor-pointer`}
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-2xl">{frameworkStyle.icon}</span>
              <span className="px-2 py-1 rounded bg-white/20 backdrop-blur text-xs font-medium">
                {parsedException.framework?.toUpperCase()}
              </span>
              {parsedException.error.severity && (
                <span className="px-2 py-1 rounded bg-white/20 backdrop-blur text-xs font-medium">
                  {parsedException.error.severity.toUpperCase()}
                </span>
              )}
              {server && (
                <span className="px-2 py-1 rounded bg-white/20 backdrop-blur text-xs font-medium">
                  {server.name}
                </span>
              )}
              <span className="text-sm opacity-75">{formatTimestamp(dump.timestamp)}</span>
            </div>
            <h3 className="text-lg font-bold mb-1">{parsedException.error.class}</h3>
            <p className="text-sm opacity-95 line-clamp-2">{parsedException.error.message}</p>
            {parsedException.error.file && (
              <div className="mt-2 flex items-center space-x-2 text-xs opacity-75">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="font-mono">
                  {parsedException.error.file.split('/').pop()}:{parsedException.error.line}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {parsedException.solutions.length > 0 && (
              <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                💡 {parsedException.solutions.length} solution
                {parsedException.solutions.length > 1 ? 's' : ''}
              </div>
            )}
            <svg
              className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          {/* Mini Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            {[
              { key: 'stacktrace', label: 'Stack Trace', count: parsedException.stackTrace.length },
              {
                key: 'context',
                label: 'Context',
                available: Object.keys(parsedException.context).length > 0
              },
              { key: 'solutions', label: 'Solutions', count: parsedException.solutions.length }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveTab(tab.key as any)
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                disabled={tab.available === false}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-4 max-h-96 overflow-y-auto">
            {/* Stack Trace */}
            {activeTab === 'stacktrace' && (
              <div className="space-y-2">
                {parsedException.stackTrace.slice(0, 5).map((frame, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFrame(index)
                      }}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500 font-mono text-xs">#{index}</span>
                          <div>
                            {frame.class && (
                              <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                                {frame.class}
                                {frame.type && <span className="text-gray-500">{frame.type}</span>}
                                {frame.function}()
                              </span>
                            )}
                            {!frame.class && frame.function && (
                              <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                                {frame.function}()
                              </span>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {frame.file}:{frame.line}
                              {frame.column && `:${frame.column}`}
                            </div>
                          </div>
                        </div>
                        {frame.file && onOpenInIde && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenInIde(frame.file, frame.line)
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Open in IDE"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </button>

                    {expandedFrames.has(index) && frame.code && (
                      <div className="p-3 bg-gray-900 dark:bg-black">
                        <pre className="text-xs font-mono text-gray-300 overflow-x-auto">
                          {frame.code.map((line, i) => (
                            <div
                              key={i}
                              className={`${
                                i === Math.floor(frame.code.length / 2)
                                  ? 'bg-red-500/20 border-l-2 border-red-500 pl-2'
                                  : 'pl-3'
                              }`}
                            >
                              <span className="inline-block w-8 text-gray-500">
                                {(frame.line || 0) - Math.floor(frame.code.length / 2) + i}
                              </span>
                              <span>{line}</span>
                            </div>
                          ))}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
                {parsedException.stackTrace.length > 5 && (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
                    ... and {parsedException.stackTrace.length - 5} more frames
                  </div>
                )}
              </div>
            )}

            {/* Context */}
            {activeTab === 'context' && (
              <div className="space-y-4">
                {parsedException.context.request && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                      Request
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded text-sm">
                      <div className="flex items-center space-x-3 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            parsedException.context.request.method === 'GET'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              : parsedException.context.request.method === 'POST'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {parsedException.context.request.method}
                        </span>
                        <span className="font-mono text-xs">
                          {parsedException.context.request.url}
                        </span>
                      </div>
                      {parsedException.context.request.ip && (
                        <div className="text-xs text-gray-500">
                          IP: {parsedException.context.request.ip}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {parsedException.context.user && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                      User
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded text-sm">
                      <div className="space-y-1">
                        {parsedException.context.user.email && (
                          <div className="text-xs">
                            <span className="text-gray-500">Email:</span>{' '}
                            {parsedException.context.user.email}
                          </div>
                        )}
                        {parsedException.context.user.id && (
                          <div className="text-xs">
                            <span className="text-gray-500">ID:</span>{' '}
                            {parsedException.context.user.id}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {parsedException.context.database && parsedException.context.database.query && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                      Database Query
                    </h4>
                    <div className="bg-gray-900 p-3 rounded">
                      <pre className="text-xs font-mono text-gray-300 overflow-x-auto">
                        {parsedException.context.database.query}
                      </pre>
                      {parsedException.context.database.time && (
                        <div className="mt-2 text-xs text-gray-400">
                          Execution time: {parsedException.context.database.time}ms
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {parsedException.context.environment && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                      Environment
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(parsedException.context.environment).map(([key, value]) => (
                        <div key={key} className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                          <span className="text-xs text-gray-500">{key.replace(/_/g, ' ')}:</span>
                          <div className="font-mono text-xs">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Solutions */}
            {activeTab === 'solutions' && (
              <div className="space-y-3">
                {parsedException.solutions.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No automatic solutions found for this error.
                  </div>
                ) : (
                  parsedException.solutions.map((solution, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 dark:border-gray-700 rounded p-3"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h5 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                          {solution.title}
                        </h5>
                        {solution.probability && (
                          <span
                            className={`px-1.5 py-0.5 text-xs rounded-full ${
                              solution.probability >= 80
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : solution.probability >= 60
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            {solution.probability}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        {solution.description}
                      </p>
                      {solution.code && (
                        <pre className="p-2 bg-gray-900 text-gray-300 rounded text-xs overflow-x-auto">
                          {solution.code}
                        </pre>
                      )}
                      {solution.link && (
                        <a
                          href={solution.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center mt-2 text-blue-600 dark:text-blue-400 hover:underline text-xs"
                        >
                          Learn more →
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
