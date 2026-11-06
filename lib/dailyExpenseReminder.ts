import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const REMINDER_ID_KEY = "@expense_tracker_daily_expense_reminder_id";
const REMINDER_KIND = "daily-expense-reminder";

export async function scheduleDailyExpenseReminder(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;
  if (status !== Notifications.PermissionStatus.GRANTED) {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== Notifications.PermissionStatus.GRANTED) {
    return false;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily-reminders", {
      name: "Daily reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2F6B5F",
    });
  }

  await cancelDailyExpenseReminder();
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Log today's expenses",
      body: "Take a minute to add what you spent today.",
      data: { kind: REMINDER_KIND, route: "/add-expense" },
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
      ...(Platform.OS === "android" ? { channelId: "daily-reminders" } : {}),
    },
  });

  await AsyncStorage.setItem(REMINDER_ID_KEY, identifier);
  return true;
}

export async function cancelDailyExpenseReminder(): Promise<void> {
  const identifier = await AsyncStorage.getItem(REMINDER_ID_KEY);
  if (identifier) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    await AsyncStorage.removeItem(REMINDER_ID_KEY);
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.content.data?.kind === REMINDER_KIND)
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier)
      )
  );
}

export async function isDailyExpenseReminderEnabled(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some(
    (notification) => notification.content.data?.kind === REMINDER_KIND
  );
}
