export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface RequestPayload {
  type: string
  data: string | object
}

export enum ResponsePayloadType {
  Voice = 'V',
  Response = 'R',
  Search = 'S',
  Browse = 'B',
  Python = 'P',
  PythonWithEvaluation = 'E',
  Pip = 'p',
  Card = 'C',
  Open = 'O',
  Play = 'Y',
  Reminders = 'r',
  Calendar = 'c',
  Email = 'e',
  Text = 'T',
  Pop = ' ',
  Unknown = '?',
  FollowUp = 'x',
  End = 'X',
}
