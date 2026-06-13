// 防止額外 console window 在 Windows 上，macOS 自動忽略
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tw_car_claim_estimator_lib::run()
}
