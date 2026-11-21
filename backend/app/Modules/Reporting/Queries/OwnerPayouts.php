<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Support\Facades\DB;
use stdClass;

/**
 * Reversements du mandant, lus en SQL dans OwnerFunds (ADR 0005, 0032) : éléments en cours, versés ou retournés, jamais un brouillon,
 * un élément inclus ou exclu, une référence bancaire ni un motif d'échec. Le co-indivisaire n'y accède pas : il ne reçoit pas de reversement.
 */
final readonly class OwnerPayouts
{
    public const array STATUTS = ['pending', 'paid', 'returned'];

    public const array ROLES = ['holder', 'representative'];

    public const array MOTIFS_COMMUNICABLES = ['no_payout_account', 'account_recently_changed', 'below_minimum', 'before_payout_day'];

    public function __construct(private CurrentOrganization $contexte, private MandateDirectory $mandats) {}

    /**
     * @return CursorPaginator<int, stdClass>
     */
    public function page(OwnerScopeData $portee, int $parPage, ?string $curseur): CursorPaginator
    {
        $requete = $portee->restrictToMandants(DB::table('payout_items'), 'organization_id', 'mandant_party_id', self::ROLES)
            ->whereIn('status', self::STATUTS)
            ->select(['id', 'organization_id', 'batch_id', 'mandant_party_id', 'status', 'net_amount', 'currency', 'bank_last4', 'executed_on'])
            ->orderByDesc('id');

        $page = $requete->cursorPaginate($parPage, cursor: $curseur);
        $lots = $this->lots($page->items());

        foreach ($page->items() as $element) {
            $lot = $lots[$element->organization_id.'|'.$element->batch_id] ?? null;
            $element->number = $lot?->number;
            $element->date = $element->executed_on ?? $lot?->execution_on;
        }

        return $page;
    }

    /**
     * Prochain reversement indicatif de chaque couple (agence, mandant) : le jour de reversement du mandat qui couvre ses lots et,
     * si le dernier lot ouvert l'a écarté pour l'un des quatre motifs communicables, ce motif.
     *
     * @return list<array{visible: OwnerVisibleData, date: string|null, notice: string|null}>
     */
    public function next(OwnerScopeData $portee, CarbonImmutable $aujourdhui): array
    {
        $prochains = [];

        foreach ($portee->visibles as $visible) {
            if ($visible->role === OwnerAccessRole::CoOwner) {
                continue;
            }

            $prochains[] = $this->contexte->run($visible->organizationId, fn (): array => [
                'visible' => $visible,
                'date' => $this->prochaineDate($portee, $visible, $aujourdhui),
                'notice' => $this->motif($visible),
            ]);
        }

        return $prochains;
    }

    /**
     * Reversement en attente d'exécution et dernier reversement versé d'un couple (agence, mandant). Un seul reversement est ouvert à la
     * fois par mandant ; les honoraires sont ceux prélevés avec lui. Jamais de brouillon ni de référence bancaire.
     *
     * @return array{pending: array{net: int, fees: int, currency: string}|null, last: array{amount: int, date: string|null, number: string|null, currency: string}|null}
     */
    public function summary(OwnerVisibleData $visible): array
    {
        $base = fn (string $statut) => DB::table('payout_items')
            ->where('organization_id', $visible->organizationId)
            ->where('mandant_party_id', $visible->mandantPartyId)
            ->where('status', $statut);

        $attente = $base('pending')->orderByDesc('id')->first(['net_amount', 'fees_settled_amount', 'currency']);
        $dernier = $base('paid')->orderByDesc('executed_on')->orderByDesc('id')->first(['net_amount', 'currency', 'executed_on', 'batch_id']);
        $lot = $dernier === null ? null : DB::table('payout_batches')->where('organization_id', $visible->organizationId)->where('id', $dernier->batch_id)->first(['number']);

        return [
            'pending' => $attente === null ? null : ['net' => (int) $attente->net_amount, 'fees' => (int) $attente->fees_settled_amount, 'currency' => (string) $attente->currency],
            'last' => $dernier === null ? null : [
                'amount' => (int) $dernier->net_amount,
                'date' => $dernier->executed_on === null ? null : substr((string) $dernier->executed_on, 0, 10),
                'number' => $lot === null ? null : (string) $lot->number,
                'currency' => (string) $dernier->currency,
            ],
        ];
    }

    private function prochaineDate(OwnerScopeData $portee, OwnerVisibleData $visible, CarbonImmutable $aujourdhui): ?string
    {
        $lots = array_values(array_unique(array_map(
            fn ($c): string => $c->unitId,
            array_filter($portee->coverages, fn ($c): bool => $c->organizationId === $visible->organizationId && $c->mandantPartyId === $visible->mandantPartyId),
        )));
        $dates = [];

        foreach ($this->mandats->coveringUnits($lots, $aujourdhui) as $couverture) {
            if ($couverture->mandantPartyId !== $visible->mandantPartyId || $couverture->isSuspended || $couverture->status !== MandateStatus::Active) {
                continue;
            }

            $ce = $aujourdhui->startOfMonth()->addDays(min($couverture->payoutDay, $aujourdhui->daysInMonth) - 1);
            $suivant = $aujourdhui->startOfMonth()->addMonthNoOverflow();
            $dates[] = ($ce >= $aujourdhui ? $ce : $suivant->addDays(min($couverture->payoutDay, $suivant->daysInMonth) - 1))->toDateString();
        }

        return $dates === [] ? null : min($dates);
    }

    private function motif(OwnerVisibleData $visible): ?string
    {
        $motif = DB::table('payout_items as i')
            ->join('payout_batches as b', fn ($j) => $j->on('b.organization_id', '=', 'i.organization_id')->on('b.id', '=', 'i.batch_id'))
            ->where('i.organization_id', $visible->organizationId)
            ->where('i.mandant_party_id', $visible->mandantPartyId)
            ->where('i.status', 'excluded')
            ->whereIn('b.status', ['draft', 'validated'])
            ->orderByDesc('i.created_at')
            ->orderByDesc('i.id')
            ->value('i.exclusion_reason');

        return in_array($motif, self::MOTIFS_COMMUNICABLES, true) ? (string) $motif : null;
    }

    /**
     * @param  array<int, stdClass>  $elements
     * @return array<string, stdClass> numéro et date prévue des lots de virement, par `organisation|lot`
     */
    private function lots(array $elements): array
    {
        if ($elements === []) {
            return [];
        }

        $lots = DB::table('payout_batches')
            ->whereIn('id', array_values(array_unique(array_map(fn (stdClass $e): string => $e->batch_id, $elements))))
            ->whereIn('organization_id', array_values(array_unique(array_map(fn (stdClass $e): string => $e->organization_id, $elements))))
            ->get(['id', 'organization_id', 'number', 'execution_on']);
        $parCle = [];

        foreach ($lots as $lot) {
            $parCle[$lot->organization_id.'|'.$lot->id] = $lot;
        }

        return $parCle;
    }
}
