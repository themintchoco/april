#![cfg(target_os = "macos")]
#![allow(non_upper_case_globals)]

use crate::settings::get_setting;

use std::collections::HashSet;

use serde::{Serialize, Deserialize};
use serde_json::Value;
use tokio::sync::mpsc;
use icrate::{
    objc2::{rc::{Id, Shared}, runtime::Bool, ClassType},
    block2::ConcreteBlock,
    Foundation::{NSString, NSArray, NSDate, NSError, NSCalendar, NSCalendarUnitDay, NSCalendarUnitMonth, NSCalendarUnitYear, NSCalendarUnitHour, NSCalendarUnitMinute},
    EventKit::{EKEventStore, EKCalendar, EKReminder, EKEntityTypeReminder, EKAuthorizationStatusAuthorized, EKAuthorizationStatusNotDetermined},
};

static mut EVENT_STORE: *const Id<EKEventStore, Shared> = std::ptr::null();

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemindersList {
    identifier: String,
    title: String,
    allows_content_modifications: bool,
    source: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    identifier: String,
    title: String,
    due_date: f64,
    completion_date: f64,
}

pub unsafe fn init_event_store() {
    EVENT_STORE = Box::leak(Box::new(EKEventStore::init(EKEventStore::alloc())));
}

unsafe fn get_calendar_identifier(calendar: &EKCalendar) -> String {
    // EKCalendar.calendarIdentifier is not persistent
    // falling back to a combination of EKSource.sourceIdentifier and EKCalendar.title

    format!("{}-{}", calendar.source().unwrap().sourceIdentifier().to_string(), calendar.title().to_string())
}

async unsafe fn request_permissions() -> Result<(), String> {
    match EKEventStore::authorizationStatusForEntityType(EKEntityTypeReminder) {
        EKAuthorizationStatusAuthorized => Ok(()),
        EKAuthorizationStatusNotDetermined => {
            let (tx, mut rx) = mpsc::channel(1);

            (*EVENT_STORE).requestAccessToEntityType_completion(EKEntityTypeReminder, &*ConcreteBlock::new(move |granted: Bool, error: *mut NSError| {
                let _ = tx.blocking_send((granted.as_bool(), error.as_ref().map(|error| error.to_string())));
            }).copy() as *const _ as *mut _);

            match rx.recv().await {
                Some((true, _)) => Ok(()),
                Some((false, Some(error))) => Err(error),
                _ => Err("An unknown error has occurred while attempting to access reminders".into()),
            }
        },
        _ => Err("Unable to access reminders due to insufficient permissions".into()),
    }
}

unsafe fn calendars() -> Id<NSArray<EKCalendar>, Shared> {
    (*EVENT_STORE).calendarsForEntityType(EKEntityTypeReminder)
}

unsafe fn enabled_calendars(app: &tauri::AppHandle) -> Option<Vec<Id<EKCalendar, Shared>>> {
    let enabled_lists: HashSet<String> = HashSet::from_iter(
        get_setting(&app, "remindersLists")?
            .as_array()?.iter()
            .filter_map(|value| {
                match value {
                    Value::String(identifier) => Some(identifier.into()),
                    _ => None,
                }
            })
        );

    Some(calendars().to_shared_vec().into_iter()
        .filter(|calendar| enabled_lists.contains(&get_calendar_identifier(calendar)))
        .collect())
}

#[tauri::command]
pub async fn get_lists() -> Result<Vec<RemindersList>, String> {
    unsafe {
        request_permissions().await?;

        Ok(calendars().iter()
            .map(|calendar| {
                let identifier = get_calendar_identifier(calendar);
                let title = (*calendar).title().to_string();
                let allows_content_modifications = (*calendar).allowsContentModifications();
                let source = (*calendar).source().unwrap().title().to_string();

                RemindersList {
                    identifier,
                    title,
                    allows_content_modifications,
                    source,
                }
            })
            .collect())
    }
}

#[tauri::command]
pub async fn get_enabled_lists(app: tauri::AppHandle) -> Result<Vec<RemindersList>, String> {
    unsafe {
        request_permissions().await?;

        Ok(enabled_calendars(&app).ok_or("Unable to access settings for enabled reminders")?.iter()
            .map(|calendar| {
                let identifier = get_calendar_identifier(calendar);
                let title = (*calendar).title().to_string();
                let allows_content_modifications = (*calendar).allowsContentModifications();
                let source = (*calendar).source().unwrap().title().to_string();

                RemindersList {
                    identifier,
                    title,
                    allows_content_modifications,
                    source,
                }
            })
            .collect())
    }
}

#[tauri::command]
pub async fn get_reminders(app: tauri::AppHandle, only_incomplete: Option<bool>) -> Result<Vec<Reminder>, String> {
    unsafe {
        request_permissions().await?;

        let (tx, mut rx) = mpsc::channel(1);

        (*EVENT_STORE).fetchRemindersMatchingPredicate_completion(
            {
                let calendars = NSArray::from_vec(enabled_calendars(&app).ok_or("Unable to access settings for enabled reminders")?);

                match only_incomplete {
                    Some(true) => (*EVENT_STORE).predicateForIncompleteRemindersWithDueDateStarting_ending_calendars(None, None, Some(&calendars)),
                    _ => (*EVENT_STORE).predicateForRemindersInCalendars(Some(&calendars)),
                }.as_ref()
            },
            &*ConcreteBlock::new(move |reminders: *mut NSArray<EKReminder>| {
                let _ = tx.blocking_send(
                    reminders.as_ref()
                        .map(|reminders| reminders.iter()
                            .map(|reminder| {
                                let identifier = (*reminder).calendarItemIdentifier().to_string();
                                let title = (*reminder).title().to_string();
                                let due_date = (*reminder).dueDateComponents().map_or(0.0, |components| components.date().map_or(0.0, |date| date.timeIntervalSince1970()));
                                let completion_date = (*reminder).completionDate().map_or(0.0, |date| date.timeIntervalSince1970());

                                Reminder {
                                    identifier,
                                    title,
                                    due_date,
                                    completion_date,
                                }
                            })
                            .collect()
                        )
                    );
            }).copy());

        match rx.recv().await {
            Some(Some(reminders)) => Ok(reminders),
            _ => Err("An unknown error has occurred while attempting to access reminders".into()),
        }
    }
}

#[tauri::command]
pub async fn add_to_list(list_name: String, title: String, due_date: f64) -> Result<String, String> {
    unsafe {
        request_permissions().await?;

        (*EVENT_STORE).calendarsForEntityType(EKEntityTypeReminder).iter()
            .find(|calendar| calendar.title().to_string() == list_name)
            .map_or(Err("Unable to find calendar with the given name".into()), |calendar| {
                let date = NSDate::dateWithTimeIntervalSince1970(due_date);
                let date_components = NSCalendar::currentCalendar().components_fromDate(NSCalendarUnitDay | NSCalendarUnitMonth | NSCalendarUnitYear | NSCalendarUnitHour | NSCalendarUnitMinute, &date);

                let reminder = EKReminder::reminderWithEventStore(&*EVENT_STORE);
                reminder.setTitle(Some(&NSString::from_str(&title)));
                reminder.setDueDateComponents(Some(&date_components));
                reminder.setCalendar(Some(calendar));

                match (*EVENT_STORE).saveReminder_commit_error(&reminder, true) {
                    Ok(_) => Ok(reminder.calendarItemIdentifier().to_string()),
                    Err(error) => Err(error.to_string()),
                }
            })
    }
}

#[tauri::command]
pub async fn delete_reminder(identifier: String) -> Result<(), String> {
    unsafe {
        request_permissions().await?;

        (*EVENT_STORE).removeReminder_commit_error(
            &Id::cast::<EKReminder>((*EVENT_STORE).calendarItemWithIdentifier(&NSString::from_str(&identifier)).ok_or("Unable to find the reminder")?),
            true
        ).map_err(|error| error.to_string())
    }
}
