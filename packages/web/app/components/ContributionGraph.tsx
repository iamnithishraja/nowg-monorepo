import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";

interface EditData {
  date: string; // YYYY-MM-DD format
  count: number;
}

interface ContributionGraphProps {
  edits: EditData[];
  projectName?: string;
}

export function ContributionGraph({ edits, projectName = "Nowgai" }: ContributionGraphProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Generate exactly 1 year of data for the selected year
  const { days, stats, yearStart, yearEnd } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    // Calculate the start and end of the selected year
    const yearStartDate = new Date(selectedYear, 0, 1); // January 1st of selected year
    yearStartDate.setHours(0, 0, 0, 0);
    const yearEndDate = new Date(selectedYear, 11, 31); // December 31st of selected year
    yearEndDate.setHours(23, 59, 59, 999);
    
    // Always show full year (Jan 1 - Dec 31) like GitHub does
    // Future days will be shown as empty boxes
    const endDate = new Date(yearEndDate);
    endDate.setHours(0, 0, 0, 0);
    
    // Find the Sunday of the week containing January 1st (to align weeks properly)
    // GitHub starts from the Sunday of the week that contains Jan 1st
    const firstDay = new Date(yearStartDate);
    const dayOfWeek = firstDay.getDay(); // 0 = Sunday, 6 = Saturday
    const daysToSubtract = dayOfWeek; // Days to go back to Sunday
    const weekStart = new Date(firstDay);
    weekStart.setDate(firstDay.getDate() - daysToSubtract);
    weekStart.setHours(0, 0, 0, 0);
    
    // Show complete weeks for the full year (Jan 1 to Dec 31)
    // Find the Saturday of the week containing December 31st
    const lastDay = new Date(endDate);
    const lastDayOfWeek = lastDay.getDay(); // 0 = Sunday, 6 = Saturday
    const daysToAdd = 6 - lastDayOfWeek; // Days to add to get to Saturday
    const weekEnd = new Date(lastDay);
    weekEnd.setDate(lastDay.getDate() + daysToAdd);
    weekEnd.setHours(23, 59, 59, 999);
    
    // Create a map of date -> count
    const editMap = new Map<string, number>();
    edits.forEach((edit) => {
      const editDate = new Date(edit.date);
      // Only include edits from the selected year
      if (editDate.getFullYear() === selectedYear) {
        editMap.set(edit.date, edit.count);
      }
    });
    
    // Generate all days from week start to week end (complete weeks)
    // This ensures we show all weeks from the start of the year to today
    const allDays: Array<{ date: Date; count: number }> = [];
    const currentDate = new Date(weekStart);
    
    // Generate days up to and including weekEnd
    while (currentDate <= weekEnd) {
      const dateStr = currentDate.toISOString().split("T")[0];
      const dayDate = new Date(currentDate);
      dayDate.setHours(0, 0, 0, 0);
      
      allDays.push({
        date: dayDate,
        count: editMap.get(dateStr) || 0,
      });
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Filter edits for the selected year
    const yearEdits = edits.filter((edit) => {
      const editDate = new Date(edit.date);
      return editDate.getFullYear() === selectedYear;
    });
    
    // Calculate statistics for the selected year
    const totalEdits = yearEdits.reduce((sum, e) => sum + e.count, 0);
    const daysActive = yearEdits.length;
    const daysInYear = selectedYear === today.getFullYear() 
      ? Math.floor((today.getTime() - yearStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 365;
    const dailyAverage = daysInYear > 0 ? totalEdits / daysInYear : 0;

    
    // Calculate current streak (only for current year)
    let currentStreak = 0;
    if (selectedYear === today.getFullYear()) {
      const todayStr = today.toISOString().split("T")[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Check if today has edits
      if (editMap.has(todayStr) && editMap.get(todayStr)! > 0) {
        currentStreak = 1;
        // Count backwards
        let checkDate = new Date(yesterday);
        while (checkDate >= yearStartDate) {
          const checkStr = checkDate.toISOString().split("T")[0];
          if (editMap.has(checkStr) && editMap.get(checkStr)! > 0) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      } else {
        // Check backwards from yesterday
        let checkDate = new Date(yesterday);
        while (checkDate >= yearStartDate) {
          const checkStr = checkDate.toISOString().split("T")[0];
          if (editMap.has(checkStr) && editMap.get(checkStr)! > 0) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }
    }

    return {
      days: allDays,
      stats: {
        totalEdits,
        daysActive,
        dailyAverage,
        currentStreak,
      },
      yearStart: weekStart,
      yearEnd: endDate,
    };
  }, [edits, selectedYear]);

  // Group days by week (Sunday to Saturday) - exactly 7 days per week
  const weeks = useMemo(() => {
    const weekGroups: Array<Array<{ date: Date; count: number }>> = [];
    
    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7);
      if (week.length > 0) {
        weekGroups.push(week);
      }
    }
    
    return weekGroups;
  }, [days]);

  // Get month labels (using explicit month names to avoid locale issues)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabels = useMemo(() => {
    const labels: Array<{ month: string; weekIndex: number }> = [];
    const seenMonths = new Set<string>();
    
    weeks.forEach((week, weekIndex) => {
      if (week.length > 0) {
        const firstDay = week[0].date;
        const month = monthNames[firstDay.getMonth()];
        
        if (!seenMonths.has(month)) {
          seenMonths.add(month);
          labels.push({ month, weekIndex });
        }
      }
    });
    
    return labels;
  }, [weeks]);

  // Get intensity level for a day (0-4)
  const getIntensity = (count: number): number => {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 5) return 3;
    return 4;
  };

  // Get color class based on intensity
  const getColorClass = (intensity: number): string => {
    switch (intensity) {
      case 0:
        return "bg-[#161b22] border border-[#30363d]";
      case 1:
        return "bg-[#0e4429] border border-[#0e4429]";
      case 2:
        return "bg-[#006d32] border border-[#006d32]";
      case 3:
        return "bg-[#26a641] border border-[#26a641]";
      case 4:
        return "bg-[#39d353] border border-[#39d353]";
      default:
        return "bg-[#161b22] border border-[#30363d]";
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", { 
      weekday: "long", 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    });
  };

  // Get available years from edits data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    edits.forEach((edit) => {
      const year = new Date(edit.date).getFullYear();
      years.add(year);
    });
    const currentYear = new Date().getFullYear();
    years.add(currentYear); // Always include current year
    return Array.from(years).sort((a, b) => b - a); // Sort descending
  }, [edits]);

  const currentYear = new Date().getFullYear();
  const minYear = availableYears.length > 0 ? Math.min(...availableYears) : currentYear;
  const canGoBack = selectedYear > minYear;
  const canGoForward = selectedYear < currentYear;

  return (
    <div className="bg-surface-1 border border-subtle rounded-[12px] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">
          {stats.totalEdits} contribution{stats.totalEdits !== 1 ? "s" : ""} in {selectedYear}
        </h2>
        
        {/* Year Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedYear(selectedYear - 1)}
            disabled={!canGoBack}
            className="h-8 w-8 p-0 text-tertiary hover:text-primary disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-surface-2 border border-subtle rounded-md px-3 py-1 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedYear(selectedYear + 1)}
            disabled={!canGoForward}
            className="h-8 w-8 p-0 text-tertiary hover:text-primary disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Calendar Grid */}
        <div className="flex-1">
          {/* Month labels row */}
          <div className="flex gap-1 mb-2 pl-7">
            {weeks.map((week, weekIndex) => {
              const firstDay = week[0]?.date;
              if (!firstDay) return <div key={weekIndex} className="w-3" />;
              
              // Get month name using explicit array (avoid locale issues)
              const month = monthNames[firstDay.getMonth()];
              
              // Skip if this is December from previous year (first partial week)
              if (firstDay.getFullYear() < selectedYear) {
                return <div key={weekIndex} className="w-3" />;
              }
              
              const prevWeek = weeks[weekIndex - 1];
              const prevMonth = prevWeek?.[0]?.date
                ? monthNames[prevWeek[0].date.getMonth()]
                : null;
              
              // Only show month label if it's the first week of the month or first week overall
              if (weekIndex > 0 && prevMonth === month) {
                return <div key={weekIndex} className="w-3" />;
              }
              
              return (
                <div
                  key={weekIndex}
                  className="text-xs text-tertiary whitespace-nowrap w-3 text-center"
                >
                  {month}
                </div>
              );
            })}
          </div>

          {/* Week columns */}
          <div className="flex gap-1 pb-2">
            {/* Day labels column */}
            <div className="flex flex-col gap-1 pr-2 flex-shrink-0">
              {["", "Mon", "", "Wed", "", "Fri", ""].map((day, i) => (
                <div key={i} className="text-xs text-tertiary h-3 flex items-center">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid - scrollable to show all weeks */}
            <div className="flex gap-1 overflow-x-auto min-w-0 flex-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1 flex-shrink-0">
                  {week.map((day, dayIndex) => {
                    const intensity = getIntensity(day.count);
                    const colorClass = getColorClass(intensity);
                    const dateStr = formatDate(day.date);
                    
                    // Check if this day is in the future (for current year)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isFuture = selectedYear === today.getFullYear() && day.date > today;
                    
                    return (
                      <div
                        key={`${weekIndex}-${dayIndex}`}
                        className={`w-3 h-3 rounded-sm ${colorClass} cursor-pointer hover:ring-2 hover:ring-white/20 transition-all ${isFuture ? 'opacity-50' : ''}`}
                        title={`${dateStr}: ${day.count} contribution${day.count !== 1 ? "s" : ""}`}
                      />
                    );
                  })}
                  {/* Fill remaining days if week is incomplete (shouldn't happen with proper grouping) */}
                  {week.length < 7 && Array.from({ length: 7 - week.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="w-3 h-3" />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 text-xs text-tertiary">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-[#161b22] border border-[#30363d]" />
              <div className="w-3 h-3 rounded-sm bg-[#0e4429] border border-[#0e4429]" />
              <div className="w-3 h-3 rounded-sm bg-[#006d32] border border-[#006d32]" />
              <div className="w-3 h-3 rounded-sm bg-[#26a641] border border-[#26a641]" />
              <div className="w-3 h-3 rounded-sm bg-[#39d353] border border-[#39d353]" />
            </div>
            <span>More</span>
          </div>
        </div>

        {/* Statistics Panel */}
        <div className="flex flex-col gap-4 min-w-[180px]">
          <div>
            <div className="text-xs text-tertiary mb-1">Daily Average</div>
            <div className="text-lg font-bold text-primary">
              {stats.dailyAverage.toFixed(1)} contribution{stats.dailyAverage !== 1 ? "s" : ""}
            </div>
          </div>
          
          <div>
            <div className="text-xs text-tertiary mb-1">Days Active</div>
            <div className="text-lg font-bold text-primary">
              {stats.daysActive} day{stats.daysActive !== 1 ? "s" : ""}
            </div>
            <div className="text-xs text-tertiary mt-0.5">
              {selectedYear === new Date().getFullYear() 
                ? `${((stats.daysActive / (Math.floor((new Date().getTime() - new Date(selectedYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1)) * 100).toFixed(0)}% of year`
                : `${((stats.daysActive / 365) * 100).toFixed(0)}% of year`}
            </div>
          </div>
          
          <div>
            <div className="text-xs text-tertiary mb-1">Current Streak</div>
            <div className="text-lg font-bold text-primary">
              {stats.currentStreak} day{stats.currentStreak !== 1 ? "s" : ""}
            </div>
          </div>
          
          <div>
            <div className="text-xs text-tertiary mb-1">Total Contributions</div>
            <div className="text-lg font-bold text-primary">{stats.totalEdits}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
