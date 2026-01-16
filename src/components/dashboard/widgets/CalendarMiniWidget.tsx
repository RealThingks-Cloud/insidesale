import React, { memo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTodaysMeetings, useUpcomingMeetings } from "@/hooks/useDashboardData";
import { WidgetLoadingSkeleton } from "./WidgetLoadingSkeleton";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfWeek, addDays, isSameDay, isToday } from "date-fns";

interface CalendarMiniWidgetProps {
  isResizeMode?: boolean;
}

export const CalendarMiniWidget = memo(({ isResizeMode }: CalendarMiniWidgetProps) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const { data: upcomingMeetings, isLoading } = useUpcomingMeetings();
  const navigate = useNavigate();

  if (isLoading) return <WidgetLoadingSkeleton showHeader rows={3} />;

  const today = new Date();
  const currentWeekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  // Get meetings for each day
  const meetingsByDay = weekDays.map(day => {
    const dayMeetings = upcomingMeetings?.meetings?.filter((m: any) => 
      isSameDay(new Date(m.start_time), day)
    ) || [];
    return { date: day, meetings: dayMeetings };
  });

  const hasMeetingsThisWeek = meetingsByDay.some(d => d.meetings.length > 0);

  return (
    <Card className="h-full hover:shadow-lg transition-shadow animate-fade-in overflow-hidden flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 flex-shrink-0">
        <CardTitle className="text-sm font-medium truncate flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-primary" />
          Calendar
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 w-5 p-0"
            onClick={() => setWeekOffset(prev => prev - 1)}
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <span className="text-[10px] text-muted-foreground min-w-[60px] text-center">
            {format(currentWeekStart, 'MMM d')}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 w-5 p-0"
            onClick={() => setWeekOffset(prev => prev + 1)}
          >
            <ChevronRight className="w-3 h-3" />
          </Button>
          {weekOffset !== 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-5 text-[10px] px-1.5"
              onClick={() => setWeekOffset(0)}
            >
              Today
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 flex-1 min-h-0 flex flex-col">
        <div className="grid grid-cols-7 gap-0.5 mb-1.5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center text-[9px] text-muted-foreground font-medium">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 flex-1">
          {meetingsByDay.map(({ date, meetings }) => {
            const isCurrentDay = isToday(date);
            const hasMeetings = meetings.length > 0;
            
            return (
              <div 
                key={date.toISOString()}
                className={`flex flex-col items-center p-1 rounded cursor-pointer transition-colors ${
                  isCurrentDay 
                    ? 'bg-primary/10 ring-1 ring-primary/30' 
                    : hasMeetings 
                      ? 'bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/40' 
                      : 'hover:bg-muted'
                }`}
                onClick={() => !isResizeMode && navigate('/meetings')}
              >
                <span className={`text-xs font-medium ${isCurrentDay ? 'text-primary' : ''}`}>
                  {format(date, 'd')}
                </span>
                {hasMeetings && (
                  <div className="flex gap-0.5 mt-0.5">
                    {meetings.slice(0, 3).map((_: any, i: number) => (
                      <div 
                        key={i} 
                        className="w-1 h-1 rounded-full bg-blue-500"
                      />
                    ))}
                    {meetings.length > 3 && (
                      <span className="text-[8px] text-blue-600">+{meetings.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {!hasMeetingsThisWeek && (
          <p className="text-[10px] text-muted-foreground text-center mt-2 pt-2 border-t">
            No meetings this week
          </p>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-2 h-6 text-xs w-full"
          onClick={() => !isResizeMode && navigate('/meetings')}
        >
          View Full Calendar
        </Button>
      </CardContent>
    </Card>
  );
});

CalendarMiniWidget.displayName = "CalendarMiniWidget";
