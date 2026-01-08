import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string;
  due_time: string | null;
  status: string;
  module_type: string | null;
  assigned_to: string;
}

interface UserTasks {
  userId: string;
  email: string;
  fullName: string;
  tasks: Task[];
  overdueTasks: Task[];
}

const priorityEmoji: Record<string, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

const formatTime = (time: string | null): string => {
  if (!time || time === "00:00:00") return "";
  try {
    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
};

const generateEmailHtml = (userTasks: UserTasks, appUrl: string): string => {
  const { fullName, tasks, overdueTasks } = userTasks;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const renderTask = (task: Task, isOverdue: boolean = false) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px 8px; vertical-align: top;">
        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${
          task.priority === "high" ? "#ef4444" : task.priority === "medium" ? "#eab308" : "#22c55e"
        }; margin-right: 8px;"></span>
      </td>
      <td style="padding: 12px 8px;">
        <div style="font-weight: 500; color: #1f2937;">${task.title}</div>
        ${task.description ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${task.description.substring(0, 100)}${task.description.length > 100 ? "..." : ""}</div>` : ""}
        ${isOverdue ? `<div style="font-size: 11px; color: #ef4444; margin-top: 4px;">Due: ${new Date(task.due_date).toLocaleDateString()}</div>` : ""}
      </td>
      <td style="padding: 12px 8px; text-align: right; white-space: nowrap;">
        ${formatTime(task.due_time) ? `<span style="font-size: 12px; color: #6b7280;">${formatTime(task.due_time)}</span>` : ""}
        ${task.module_type ? `<span style="display: inline-block; font-size: 10px; background: #f3f4f6; color: #4b5563; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">${task.module_type}</span>` : ""}
      </td>
    </tr>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Daily Task Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">📋 Daily Task Reminder</h1>
      <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">${today}</p>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <p style="margin: 0 0 24px; color: #374151; font-size: 16px;">
        Good morning, <strong>${fullName || "there"}</strong>! 👋
      </p>

      ${overdueTasks.length > 0 ? `
      <!-- Overdue Section -->
      <div style="margin-bottom: 24px; padding: 16px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
        <h2 style="margin: 0 0 12px; color: #991b1b; font-size: 16px; font-weight: 600;">
          ⚠️ Overdue Tasks (${overdueTasks.length})
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            ${overdueTasks.map(task => renderTask(task, true)).join("")}
          </tbody>
        </table>
      </div>
      ` : ""}

      ${tasks.length > 0 ? `
      <!-- Today's Tasks -->
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 16px; font-weight: 600;">
          📌 Due Today (${tasks.length})
        </h2>
        <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px;">
          <tbody>
            ${tasks.map(task => renderTask(task)).join("")}
          </tbody>
        </table>
      </div>
      ` : `
      <div style="text-align: center; padding: 24px; background: #f0fdf4; border-radius: 8px;">
        <p style="margin: 0; color: #166534; font-size: 16px;">✨ No tasks due today!</p>
      </div>
      `}

      <!-- Summary -->
      <div style="margin-top: 24px; padding: 16px; background: #f3f4f6; border-radius: 8px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #4b5563;">
          ${tasks.length > 0 || overdueTasks.length > 0 
            ? `You have <strong>${tasks.length}</strong> task${tasks.length !== 1 ? "s" : ""} due today${overdueTasks.length > 0 ? ` and <strong style="color: #ef4444;">${overdueTasks.length}</strong> overdue` : ""}.` 
            : "You're all caught up! Great job! 🎉"}
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/tasks" style="display: inline-block; padding: 12px 32px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
          View All Tasks →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        You're receiving this because you have task reminders enabled.<br>
        <a href="${appUrl}/settings" style="color: #6b7280; text-decoration: underline;">Manage notification settings</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting send-task-reminders function...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];
    console.log(`Fetching tasks for date: ${today}`);

    // Fetch all incomplete tasks due today
    const { data: todayTasks, error: todayError } = await supabase
      .from("tasks")
      .select("*")
      .eq("due_date", today)
      .in("status", ["open", "in_progress"]);

    if (todayError) {
      console.error("Error fetching today's tasks:", todayError);
      throw todayError;
    }

    // Fetch overdue tasks
    const { data: overdueTasks, error: overdueError } = await supabase
      .from("tasks")
      .select("*")
      .lt("due_date", today)
      .in("status", ["open", "in_progress"]);

    if (overdueError) {
      console.error("Error fetching overdue tasks:", overdueError);
      throw overdueError;
    }

    console.log(`Found ${todayTasks?.length || 0} tasks due today, ${overdueTasks?.length || 0} overdue`);

    // Get unique user IDs
    const allTasks = [...(todayTasks || []), ...(overdueTasks || [])];
    const userIds = [...new Set(allTasks.map(t => t.assigned_to).filter(Boolean))];

    if (userIds.length === 0) {
      console.log("No users with tasks to notify");
      return new Response(
        JSON.stringify({ success: true, message: "No users to notify", emailsSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user profiles and notification preferences
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select('id, full_name, "Email ID"')
      .in("id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Fetch notification preferences
    const { data: notifPrefs, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("user_id, task_reminders, email_notifications")
      .in("user_id", userIds);

    if (prefsError) {
      console.error("Error fetching notification preferences:", prefsError);
    }

    // Group tasks by user
    const userTasksMap = new Map<string, UserTasks>();

    for (const userId of userIds) {
      const profile = profiles?.find(p => p.id === userId);
      const prefs = notifPrefs?.find(p => p.user_id === userId);

      // Skip if user has disabled task reminders or email notifications
      if (prefs && (prefs.task_reminders === false || prefs.email_notifications === false)) {
        console.log(`Skipping user ${userId} - notifications disabled`);
        continue;
      }

      const email = profile?.["Email ID"];
      if (!email) {
        console.log(`Skipping user ${userId} - no email found`);
        continue;
      }

      const userTodayTasks = (todayTasks || []).filter(t => t.assigned_to === userId);
      const userOverdueTasks = (overdueTasks || []).filter(t => t.assigned_to === userId);

      // Skip if user has no tasks
      if (userTodayTasks.length === 0 && userOverdueTasks.length === 0) {
        continue;
      }

      userTasksMap.set(userId, {
        userId,
        email,
        fullName: profile?.full_name || "",
        tasks: userTodayTasks,
        overdueTasks: userOverdueTasks,
      });
    }

    console.log(`Preparing to send emails to ${userTasksMap.size} users`);

    // Get app URL from request or environment
    const appUrl = Deno.env.get("APP_URL") || "https://your-app.lovable.dev";
    
    // Send emails via the send-email function
    const emailResults: { userId: string; success: boolean; error?: string }[] = [];

    for (const [userId, userTasks] of userTasksMap) {
      try {
        const emailHtml = generateEmailHtml(userTasks, appUrl);
        const taskCount = userTasks.tasks.length + userTasks.overdueTasks.length;
        
        // Call the existing send-email edge function
        const { error: emailError } = await supabase.functions.invoke("send-email", {
          body: {
            to: userTasks.email,
            subject: `📋 You have ${taskCount} task${taskCount !== 1 ? "s" : ""} to complete today`,
            html: emailHtml,
            recipientName: userTasks.fullName,
          },
        });

        if (emailError) {
          console.error(`Failed to send email to ${userTasks.email}:`, emailError);
          emailResults.push({ userId, success: false, error: emailError.message });
        } else {
          console.log(`Email sent successfully to ${userTasks.email}`);
          emailResults.push({ userId, success: true });
        }
      } catch (err) {
        console.error(`Exception sending email to user ${userId}:`, err);
        emailResults.push({ userId, success: false, error: String(err) });
      }
    }

    const successCount = emailResults.filter(r => r.success).length;
    const failCount = emailResults.filter(r => !r.success).length;

    console.log(`Email sending complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${successCount} reminder emails`,
        emailsSent: successCount,
        emailsFailed: failCount,
        results: emailResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-task-reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
