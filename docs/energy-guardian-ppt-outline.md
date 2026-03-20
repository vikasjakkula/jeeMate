# PPT Outline: Smart Energy Guardian (Auto-Off)

## Slide 1: Title
Smart Energy Guardian (Auto-Off)
Team members + guide

## Slide 2: Problem
Appliances left ON -> wasted electricity + safety risk

## Slide 3: Proposed Solution
Measure power -> apply rule -> auto-off -> alert dashboard

## Slide 4: Block Diagram
Current/Voltage -> ESP32 -> Relay -> Dashboard via WebSocket

## Slide 5: Hardware Setup
Pins + wiring overview + safety note (low-watt demo load)

## Slide 6: Computations
Power formula and energy integration (kWh)

## Slide 7: Auto-Off Logic
Over-limit hold time + max ON time
Event labels shown on dashboard

## Slide 8: Dashboard Screenshots
Current/Power/Energy gauges + live power chart + toast

## Slide 9: Results
Before/after relay OFF screenshots
Optional: energy saved during demo window

## Slide 10: Future Scope + Q&A
Add more sensors, improve calibration, add persistent logs

