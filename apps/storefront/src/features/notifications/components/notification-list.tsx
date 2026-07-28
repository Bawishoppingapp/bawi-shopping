"use client"

import { useTransition } from "react"
import type { NotificationEntry } from "../services/notifications-client"
import { markNotificationReadAction } from "../actions/notifications-actions"

export function NotificationList({ notifications }: { notifications: NotificationEntry[] }) {
  const [, startTransition] = useTransition()

  if (!notifications.length) {
    return <p className="text-sm text-neutral-500">No notifications yet.</p>
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-200">
      {notifications.map((notification) => (
        <li
          key={notification.id}
          className={`flex items-start justify-between gap-4 py-3 ${
            notification.read_at ? "" : "bg-blue-50/50"
          }`}
          onClick={() => {
            if (!notification.read_at) {
              startTransition(() => markNotificationReadAction(notification.id))
            }
          }}
        >
          <div>
            <p className="text-sm font-medium text-neutral-900">{notification.subject}</p>
            <p className="text-sm text-neutral-600">{notification.body}</p>
            <p className="mt-1 text-xs text-neutral-400">
              {new Date(notification.created_at).toLocaleString()}
            </p>
          </div>
          {!notification.read_at && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />
          )}
        </li>
      ))}
    </ul>
  )
}
