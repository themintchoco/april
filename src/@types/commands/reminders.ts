export interface RemindersList {
  identifier: string
  title: string
  allowsContentModifications: boolean
  source: string
}

export interface Reminder {
  identifier: string
  title: string
  dueDate: number
  completionDate: number
}
