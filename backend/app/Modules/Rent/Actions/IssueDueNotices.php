<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Support\BillingCalendar;
use Carbon\CarbonImmutable;
use Throwable;

final readonly class IssueDueNotices
{
    public function __construct(private IssueNotice $avis) {}

    /**
     * Émet les avis des échéances à venir dont la date d'avis est atteinte, les plus anciennes d'abord, par lot borné.
     * Un avis en échec (PDF indisponible…) est rapporté et n'empêche pas les autres ; il reste « à venir » et se reprend.
     *
     * @return array{issued: int, failed: list<array{installment_id: string, error: string}>, remaining: bool}
     */
    public function handle(CarbonImmutable $today, int $limite): array
    {
        $echeances = Installment::query()
            ->where('status', InstallmentStatus::Upcoming->value)
            ->where('due_date', '<=', $today->addDays(BillingCalendar::NOTICE_LEAD_DAYS)->toDateString())
            ->orderBy('due_date')->orderBy('id')
            ->limit($limite + 1)
            ->get();
        $bilan = ['issued' => 0, 'failed' => [], 'remaining' => $echeances->count() > $limite];

        foreach ($echeances->take($limite) as $echeance) {
            try {
                $this->avis->handle($echeance, $today);
                $bilan['issued']++;
            } catch (Throwable $erreur) {
                report($erreur);
                $bilan['failed'][] = ['installment_id' => $echeance->id, 'error' => 'issuance_failed'];
            }
        }

        return $bilan;
    }
}
