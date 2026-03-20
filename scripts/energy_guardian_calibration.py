#!/usr/bin/env python3
"""
Energy Guardian calibration helper.

Computes current-sensor scaling from:
- ADC reading at 0A (adc_zero)
- ADC reading at a known current (adc_known with known_current_a)
- VREF and ADC bit depth

Outputs:
- sensitivity (V/A)
- current conversion formula you can paste into firmware

Usage examples:
  python3 scripts/energy_guardian_calibration.py --adc_zero 2048 --adc_known 2305 --known_current_a 0.26
"""

from __future__ import annotations

import argparse


def adc_to_voltage(adc: float, vref: float, adc_bits: int) -> float:
    adc_max = (2**adc_bits) - 1
    return adc * (vref / adc_max)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--adc_zero", type=float, required=True, help="Average ADC value when current is 0A")
    p.add_argument("--adc_known", type=float, required=True, help="Average ADC value at known_current_a")
    p.add_argument("--known_current_a", type=float, required=True, help="Known current in Amps")
    p.add_argument("--vref", type=float, default=3.3, help="ESP32 ADC reference voltage (default: 3.3)")
    p.add_argument("--adc_bits", type=int, default=12, help="ADC resolution bits (default: 12)")
    args = p.parse_args()

    v_zero = adc_to_voltage(args.adc_zero, args.vref, args.adc_bits)
    v_known = adc_to_voltage(args.adc_known, args.vref, args.adc_bits)
    delta_v = v_known - v_zero

    if args.known_current_a == 0:
        raise SystemExit("known_current_a must be non-zero.")
    if abs(delta_v) < 1e-12:
        raise SystemExit("adc_known and adc_zero give almost same voltage; check sensor wiring/reading.")

    sensitivity_v_per_a = delta_v / args.known_current_a
    sensitivity_mv_per_a = sensitivity_v_per_a * 1000.0

    print("\n=== Current Sensor Calibration ===")
    print(f"Vzero      = {v_zero:.6f} V")
    print(f"Vknown     = {v_known:.6f} V")
    print(f"deltaV     = {delta_v:.6f} V")
    print(f"sensitivity= {sensitivity_v_per_a:.8f} V/A  ({sensitivity_mv_per_a:.3f} mV/A)")
    print("\nPaste into firmware (typical):")
    print("  current_a = (Vadc - Vzero) / sensitivity_V_per_A")
    print(f"Where:")
    print(f"  Vzero = {v_zero:.6f}")
    print(f"  sensitivity_V_per_A = {sensitivity_v_per_a:.8f}\n")


if __name__ == "__main__":
    main()

