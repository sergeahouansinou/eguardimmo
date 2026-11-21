<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use Carbon\CarbonImmutable;
use Throwable;

final readonly class IssuePendingReceipts
{
    public function __construct(private IssueReceipt $quittances) {}

    /**
     * Reprend les quittances des échéances soldées qui n'en ont pas, sauf celles payées par chèque (à la demande).
     * Un échec est rapporté et n'empêche pas les autres.
     *
     * @return array{issued: int, failed: list<array{installment_id: string, error: string}>, remaining: bool}
     */
    public function handle(CarbonImmutable $today, int $limite): array
    {
        $echeances = Installment::query()
            ->where('status', InstallmentStatus::Paid->value)
            ->whereDoesntHave('receipt')
            ->orderBy('due_date')->orderBy('id')
            ->limit($limite + 1)
            ->get();
        $bilan = ['issued' => 0, 'failed' => [], 'remaining' => $echeances->count() > $limite];

        foreach ($echeances->take($limite) as $echeance) {
            try {
                if ($this->quittances->handle($echeance, $today, automatique: true) !== null) {
                    $bilan['issued']++;
                }
            } catch (Throwable $erreur) {
                report($erreur);
                $bilan['failed'][] = ['installment_id' => $echeance->id, 'error' => 'issuance_failed'];
            }
        }

        return $bilan;
    }
}
