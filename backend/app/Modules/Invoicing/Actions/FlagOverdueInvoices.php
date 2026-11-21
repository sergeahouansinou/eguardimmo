<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Actions;

use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Events\InvoiceOverdue;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Queries\OverdueOrganizations;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Throwable;

final readonly class FlagOverdueInvoices
{
    private const int LOT = 200;

    public function __construct(
        private CurrentOrganization $contexte,
        private OverdueOrganizations $organisations,
    ) {}

    /**
     * Tâche quotidienne : signale une seule fois chaque facture émise échue et non soldée, une organisation après l'autre
     * sous son contexte. Une organisation en échec est rapportée sans arrêter les autres. Rejouable : une facture
     * déjà signalée n'est plus sélectionnée.
     *
     * @return array{flagged: int, failures: list<string>}
     */
    public function handle(CarbonImmutable $today): array
    {
        $bilan = ['flagged' => 0, 'failures' => []];
        $organisations = $this->organisations->at($today);

        foreach ($organisations as $organisation) {
            try {
                $bilan['flagged'] += (int) $this->contexte->run($organisation, fn (): int => $this->flag($today));
            } catch (Throwable $erreur) {
                report($erreur);
                $bilan['failures'][] = "{$organisation} : {$erreur->getMessage()}";
            }
        }

        return $bilan;
    }

    private function flag(CarbonImmutable $today): int
    {
        $total = 0;

        do {
            $traitees = DB::transaction(function () use ($today): int {
                $factures = Invoice::query()
                    ->where('kind', InvoiceKind::Invoice->value)
                    ->whereIn('status', array_map(fn (InvoiceStatus $s): string => $s->value, InvoiceStatus::open()))
                    ->where('due_on', '<', $today->toDateString())
                    ->whereNull('overdue_flagged_at')
                    ->orderBy('id')
                    ->limit(self::LOT)
                    ->lockForUpdate()
                    ->get();

                foreach ($factures as $facture) {
                    $facture->overdue_flagged_at = now();
                    $facture->save();
                    InvoiceOverdue::dispatch($facture->id, $facture->organization_id, $facture->lease_id, (string) $facture->due_on?->toDateString());
                }

                return $factures->count();
            });
            $total += $traitees;
        } while ($traitees === self::LOT);

        return $total;
    }
}
