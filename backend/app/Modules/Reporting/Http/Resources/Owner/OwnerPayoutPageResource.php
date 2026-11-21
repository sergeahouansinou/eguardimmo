<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Resources\Owner;

use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Mandates\Data\OwnerVisibleData;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use stdClass;

/**
 * Reversements du mandant : numéro, date, montant et quatre derniers caractères du compte, rien d'autre. Le bloc `upcoming` (première
 * page seulement) donne le prochain reversement indicatif par agence et par mandant, avec au plus un motif neutre.
 *
 * @property CursorPaginator<int, stdClass> $resource
 */
final class OwnerPayoutPageResource extends ResourceCollection
{
    private const array MESSAGES = [
        'no_payout_account' => 'Aucun compte de versement n\'est enregistré : renseignez-le pour recevoir vos reversements.',
        'account_recently_changed' => 'Votre compte de versement a changé récemment : le prochain reversement attend la fin du délai de sécurité.',
        'below_minimum' => 'Le montant à reverser n\'atteint pas encore le minimum de versement.',
        'before_payout_day' => 'Le jour de reversement de votre mandat n\'est pas encore arrivé.',
    ];

    /**
     * @param  CursorPaginator<int, stdClass>  $page
     * @param  array<string, string|null>  $agences
     * @param  list<array{visible: OwnerVisibleData, date: string|null, notice: string|null}>  $prochains
     */
    public function __construct(CursorPaginator $page, private readonly OwnerScopeData $portee, private readonly array $agences, private readonly array $prochains)
    {
        parent::__construct($page);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function toArray(Request $request): array
    {
        return array_map(function (stdClass $e): array {
            $devise = $e->currency;

            return [
                'id' => $e->id,
                'number' => $e->number,
                'status' => $e->status,
                'date' => $e->date === null ? null : substr((string) $e->date, 0, 10),
                'amount' => ['amount' => (int) $e->net_amount, 'currency' => $devise],
                'bank_last4' => $e->bank_last4,
                'agency' => ['id' => $e->organization_id, 'name' => $this->agences[$e->organization_id] ?? null],
                'mandant' => ['name' => $this->portee->visible($e->organization_id, $e->mandant_party_id)?->mandantName],
            ];
        }, array_values($this->resource->items()));
    }

    /**
     * @return array<string, mixed>
     */
    public function with(Request $request): array
    {
        return ['upcoming' => array_map(fn (array $p): array => [
            'agency' => ['id' => $p['visible']->organizationId, 'name' => $this->agences[$p['visible']->organizationId] ?? null],
            'mandant' => ['name' => $p['visible']->mandantName],
            'date' => $p['date'],
            'notice' => $p['notice'] === null ? null : ['code' => $p['notice'], 'message' => self::MESSAGES[$p['notice']]],
        ], $this->prochains)];
    }
}
