<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Data\ReminderSettings;
use App\Modules\Notifications\Models\ReminderRule;
use App\Modules\Notifications\Queries\ReminderRules;
use App\Modules\Notifications\Support\ReminderSchedule;
use App\Shared\Reminders\ReminderHit;
use App\Shared\Reminders\ReminderRegistry;
use Carbon\CarbonImmutable;
use Throwable;

final readonly class SendReminders
{
    public function __construct(
        private ReminderRules $reglages,
        private ReminderRegistry $declencheurs,
        private ReminderSchedule $calendrier,
        private CreateNotifications $notifications,
    ) {}

    /**
     * La clé `{code}:{sujet}:{date de départ}:{occurrence}` rend un rejeu sans effet. Le plafond porte sur les notifications créées : un
     * cas déjà relancé ne le consomme pas. Un échec est signalé et n'arrête ni les autres cas ni les autres rappels.
     *
     * @return array{sent: int, failed: int}
     */
    public function handle(): array
    {
        $maintenant = CarbonImmutable::now();
        $restant = max(0, (int) config('notifications.reminders.max_per_run'));
        $bilan = ['sent' => 0, 'failed' => 0];

        foreach ($this->reglages->all() as $reglage) {
            if (! $reglage->enabled || $restant <= 0) {
                continue;
            }

            $envoyes = 0;

            try {
                $suspendues = array_flip($this->declencheurs->suspendedOrganizations());

                foreach ($this->declencheurs->hits($reglage->code->value, $this->calendrier->window($reglage, $maintenant)) as $cas) {
                    if ($cas->organizationId !== null && isset($suspendues[$cas->organizationId])) {
                        continue;
                    }

                    try {
                        $crees = $this->notify($reglage, $cas, $maintenant);
                    } catch (Throwable $erreur) {
                        report($erreur);
                        $bilan['failed']++;

                        continue;
                    }

                    $envoyes += $crees;
                    $restant -= $crees;

                    if ($restant <= 0) {
                        break;
                    }
                }
            } catch (Throwable $erreur) {
                report($erreur);
                $bilan['failed']++;
            }

            // Hors Eloquent : le passage de la commande ne doit pas déplacer `updated_at`, date du dernier réglage.
            ReminderRule::query()->where('code', $reglage->code->value)->toBase()
                ->update(['last_run_at' => $maintenant->format('Y-m-d H:i:s.u'), 'last_sent_count' => $envoyes]);
            $bilan['sent'] += $envoyes;
        }

        return $bilan;
    }

    private function notify(ReminderSettings $reglage, ReminderHit $cas, CarbonImmutable $maintenant): int
    {
        $rang = $this->calendrier->occurrence($reglage, $cas->since, $maintenant);

        return $this->notifications->handle(new NotificationInput(
            $reglage->code->type(),
            $cas->organizationId,
            implode(':', [$reglage->code->value, $cas->subjectId, $cas->since->toDateString(), $rang]),
            $cas->params,
            leaseId: $cas->leaseId,
            subjectId: $cas->subjectId,
            recipientId: $cas->accountId,
            channels: $reglage->channels,
        ));
    }
}
