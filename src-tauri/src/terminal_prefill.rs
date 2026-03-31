use serde::Serialize;
use std::{
  sync::{Arc, Mutex},
  time::{Duration, Instant},
};

#[derive(Clone)]
pub struct TerminalTracker(pub Arc<Mutex<Option<TrackedTerminal>>>);

#[derive(Clone)]
pub struct TrackedTerminal {
  pub hwnd: isize,
  pub terminal_label: String,
  pub last_seen: Instant,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalPrefillResponse {
  pub success: bool,
  pub inserted: bool,
  pub terminal_label: Option<String>,
  pub message: String,
  pub clipboard_restored: bool,
  pub fallback_to_copy: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalPrefillStatus {
  pub supported: bool,
  pub available: bool,
  pub terminal_label: Option<String>,
  pub message: String,
}

#[cfg(target_os = "windows")]
mod windows_impl {
  use super::{TerminalPrefillResponse, TerminalTracker, TrackedTerminal};
  use arboard::Clipboard;
  use std::{
    mem::size_of,
    thread,
    time::{Duration, Instant},
  };
  use windows::Win32::{
    Foundation::HWND,
    UI::{
      Input::KeyboardAndMouse::{
        INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
        SendInput, VIRTUAL_KEY, VK_CONTROL,
      },
      WindowsAndMessaging::{
        GetClassNameW, GetForegroundWindow, IsWindow, SW_RESTORE, SetForegroundWindow, ShowWindow,
      },
    },
  };

  const TRACKING_INTERVAL_MS: u64 = 300;
  const TRACKED_TERMINAL_MAX_AGE_SECS: u64 = 900;

  fn get_class_name(hwnd: HWND) -> Option<String> {
    let mut buffer = [0u16; 256];
    let len = unsafe { GetClassNameW(hwnd, &mut buffer) };

    if len == 0 {
      return None;
    }

    Some(String::from_utf16_lossy(&buffer[..len as usize]))
  }

  fn classify_supported_terminal(hwnd: HWND) -> Option<String> {
    let class_name = get_class_name(hwnd)?;

    match class_name.as_str() {
      "CASCADIA_HOSTING_WINDOW_CLASS" => Some("Windows Terminal".to_string()),
      "ConsoleWindowClass" => Some("控制台窗口（cmd / PowerShell）".to_string()),
      _ => None,
    }
  }

  pub fn start_tracking(tracker: TerminalTracker) {
    thread::spawn(move || loop {
      let hwnd = unsafe { GetForegroundWindow() };

      if !hwnd.0.is_null() {
        if let Some(terminal_label) = classify_supported_terminal(hwnd) {
          if let Ok(mut slot) = tracker.0.lock() {
            *slot = Some(TrackedTerminal {
              hwnd: hwnd.0 as isize,
              terminal_label,
              last_seen: Instant::now(),
            });
          }
        }
      }

      thread::sleep(Duration::from_millis(TRACKING_INTERVAL_MS));
    });
  }

  fn keyboard_input(vk: u16, flags: KEYBD_EVENT_FLAGS) -> INPUT {
    INPUT {
      r#type: INPUT_KEYBOARD,
      Anonymous: INPUT_0 {
        ki: KEYBDINPUT {
          wVk: VIRTUAL_KEY(vk),
          wScan: 0,
          dwFlags: flags,
          time: 0,
          dwExtraInfo: 0,
        },
      },
    }
  }

  fn send_ctrl_v() -> Result<(), String> {
    let inputs = [
      keyboard_input(VK_CONTROL.0 as u16, KEYBD_EVENT_FLAGS(0)),
      keyboard_input(b'V' as u16, KEYBD_EVENT_FLAGS(0)),
      keyboard_input(b'V' as u16, KEYEVENTF_KEYUP),
      keyboard_input(VK_CONTROL.0 as u16, KEYEVENTF_KEYUP),
    ];

    let sent = unsafe { SendInput(&inputs, size_of::<INPUT>() as i32) };

    if sent != inputs.len() as u32 {
      return Err("发送粘贴快捷键失败。".to_string());
    }

    Ok(())
  }

  pub fn prefill(
    tracker: &TerminalTracker,
    command: String,
  ) -> Result<TerminalPrefillResponse, String> {
    let tracked = tracker
      .0
      .lock()
      .map_err(|_| "无法读取最近活跃终端状态。".to_string())?
      .clone();

    let Some(tracked) = tracked else {
      return Ok(TerminalPrefillResponse {
        success: false,
        inserted: false,
        terminal_label: None,
        message:
          "没有找到最近活跃的受支持终端窗口。请先切到 Windows Terminal、cmd 或 PowerShell 窗口，再回来点击发送。"
            .to_string(),
        clipboard_restored: false,
        fallback_to_copy: true,
      });
    };

    if tracked.last_seen.elapsed() > Duration::from_secs(TRACKED_TERMINAL_MAX_AGE_SECS) {
      return Ok(TerminalPrefillResponse {
        success: false,
        inserted: false,
        terminal_label: Some(tracked.terminal_label),
        message:
          "最近活跃终端记录已经过期。请先把目标终端切到前台一次，再回来点击发送。"
            .to_string(),
        clipboard_restored: false,
        fallback_to_copy: true,
      });
    }

    let hwnd = HWND(tracked.hwnd as *mut std::ffi::c_void);

    if !unsafe { IsWindow(Some(hwnd)).as_bool() } {
      return Ok(TerminalPrefillResponse {
        success: false,
        inserted: false,
        terminal_label: Some(tracked.terminal_label),
        message: "最近记录的终端窗口已经不存在。请重新激活目标终端后再试。".to_string(),
        clipboard_restored: false,
        fallback_to_copy: true,
      });
    }

    unsafe {
      let _ = ShowWindow(hwnd, SW_RESTORE);
      let _ = SetForegroundWindow(hwnd);
    }
    thread::sleep(Duration::from_millis(120));

    let mut clipboard =
      Clipboard::new().map_err(|_| "无法访问系统剪贴板，不能安全地把命令粘贴到终端。".to_string())?;
    let previous_text = clipboard.get_text().ok();

    clipboard
      .set_text(command)
      .map_err(|_| "无法把命令写入系统剪贴板。".to_string())?;

    thread::sleep(Duration::from_millis(60));
    send_ctrl_v()?;
    thread::sleep(Duration::from_millis(120));

    let clipboard_restored = if let Some(previous_text) = previous_text {
      clipboard.set_text(previous_text).is_ok()
    } else {
      false
    };

    Ok(TerminalPrefillResponse {
      success: true,
      inserted: true,
      terminal_label: Some(tracked.terminal_label.clone()),
      message: format!(
        "已把推荐命令插入到 {} 的输入框中，不会自动执行。",
        tracked.terminal_label
      ),
      clipboard_restored,
      fallback_to_copy: false,
    })
  }
}

#[cfg(not(target_os = "windows"))]
mod windows_impl {
  use super::{TerminalPrefillResponse, TerminalTracker};

  pub fn start_tracking(_: TerminalTracker) {}

  pub fn prefill(_: &TerminalTracker, _: String) -> Result<TerminalPrefillResponse, String> {
    Ok(TerminalPrefillResponse {
      success: false,
      inserted: false,
      terminal_label: None,
      message: "当前终端输入框注入能力仅支持 Windows 本机桌面端。".to_string(),
      clipboard_restored: false,
      fallback_to_copy: true,
    })
  }
}

pub fn create_tracker() -> TerminalTracker {
  TerminalTracker(Arc::new(Mutex::new(None)))
}

pub fn start_tracking(tracker: TerminalTracker) {
  windows_impl::start_tracking(tracker);
}

#[tauri::command]
pub fn get_terminal_prefill_status(
  tracker: tauri::State<TerminalTracker>,
) -> TerminalPrefillStatus {
  #[cfg(target_os = "windows")]
  {
    let tracked = tracker.0.lock().ok().and_then(|slot| slot.clone());

    if let Some(tracked) = tracked {
      if tracked.last_seen.elapsed() <= Duration::from_secs(900) {
        return TerminalPrefillStatus {
          supported: true,
          available: true,
          terminal_label: Some(tracked.terminal_label),
          message: "发送时只会插入命令，不会自动回车执行。".to_string(),
        };
      }
    }

    return TerminalPrefillStatus {
      supported: true,
      available: false,
      terminal_label: None,
      message:
        "还没有检测到最近活跃的受支持终端。请先切到 Windows Terminal、cmd 或 PowerShell 窗口，再回来点击发送。"
          .to_string(),
    };
  }

  #[cfg(not(target_os = "windows"))]
  {
    let _ = tracker;

    TerminalPrefillStatus {
      supported: false,
      available: false,
      terminal_label: None,
      message: "当前只支持 Windows 本机桌面端的终端输入框插入。".to_string(),
    }
  }
}

#[tauri::command]
pub fn prefill_terminal_input(
  command: String,
  _shell: Option<String>,
  tracker: tauri::State<TerminalTracker>,
) -> Result<TerminalPrefillResponse, String> {
  windows_impl::prefill(&tracker, command)
}
