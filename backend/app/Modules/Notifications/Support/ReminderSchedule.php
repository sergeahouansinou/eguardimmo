<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Data\ReminderSettings;
use App\Modules\Notifications\Enums\ReminderTiming;
use App\Shared\Reminders\ReminderWindow;
use Carbon\CarbonImmutable;

final class ReminderSchedule
{
    private const int MARGIN_DAYS = 7;

    private const int SECONDS_PER_DAY = 86400;

    /**
     * La profondeur de la fenêtre est bornée : activer un rappel ne relance pas l'arriéré ancien.
     */
    public function window(ReminderSettings $reglage, CarbonImmutable $maintenant): ReminderWindow
    {
        if ($reglage->code->timing() === ReminderTiming::Before) {
            return new ReminderWindow($maintenant, $maintenant->addDays($reglage->delayDays));
        }

        $profondeur = $reglage->delayDays + (int) $reglage->repeatEveryDays * ($reglage->maxOccurrences - 1) + self::MARGIN_DAYS;

        return new ReminderWindow($maintenant->subDays($profondeur), $maintenant->subDays($reglage->delayDays));
    }

    /**
     * @return int rang de la relance due à cet instant, de 1 au maximum réglé
     */
    public function occurrence(ReminderSettings $reglage, CarbonImmutable $depart, CarbonImmutable $maintenant): int
    {
        if ($reglage->repeatEveryDays === null) {
            return 1;
        }

        $ecart = ($maintenant->getTimestamp() - $depart->getTimestamp()) / self::SECONDS_PER_DAY;
        $depuisLeDelai = $reglage->code->timing() === ReminderTiming::Before
            ? $reglage->delayDays - (int) floor(max(0, -$ecart))
            : (int) floor($ecart) - $reglage->delayDays;

        return max(1, min($reglage->maxOccurrences, intdiv(max(0, $depuisLeDelai), $reglage->repeatEveryDays) + 1));
    }
}
