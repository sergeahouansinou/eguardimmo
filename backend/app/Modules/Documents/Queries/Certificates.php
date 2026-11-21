<?php

declare(strict_types=1);

namespace App\Modules\Documents\Queries;

use App\Modules\Documents\Data\CertificateFilters;
use App\Modules\Documents\Enums\CertificateState;
use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Models\Certificate;
use App\Modules\Documents\Support\CertificateTypes;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

final readonly class Certificates
{
    public function __construct(private CertificateTypes $types) {}

    /**
     * @return CursorPaginator<int, Certificate>
     */
    public function list(CertificateFilters $filtres, int $parPage): CursorPaginator
    {
        $requete = Certificate::query()->with('replacement:id,replaces_id')->orderByDesc('id');

        if ($filtres->subject !== null) {
            $requete->where('subject_type', $filtres->subject->type)->where('subject_id', $filtres->subject->id);
        }

        if ($filtres->certificateTypeTermId !== null) {
            $requete->where('certificate_type_term_id', $filtres->certificateTypeTermId);
        }

        if (! $filtres->includeReplaced) {
            $requete->whereDoesntHave('replacement');
        }

        if ($filtres->state !== null) {
            $this->filterByState($requete, $filtres->state);
        }

        if ($filtres->expiresFrom !== null) {
            $requete->where('expires_on', '>=', $filtres->expiresFrom);
        }

        if ($filtres->expiresTo !== null) {
            $requete->where('expires_on', '<', $filtres->expiresTo);
        }

        return $requete->cursorPaginate($parPage);
    }

    public function get(string $id): Certificate
    {
        return (Str::isUuid($id) ? Certificate::query()->with('replacement:id,replaces_id')->find($id) : null)
            ?? throw ErrorCode::CertificateNotFound->problem();
    }

    /**
     * Le délai de rappel vient du type (module Catalog) : on regroupe les types de l'organisation par délai pour exprimer l'état en SQL.
     *
     * @param  Builder<Certificate>  $requete
     */
    private function filterByState(Builder $requete, CertificateState $etat): void
    {
        $aujourdhui = now()->toImmutable()->startOfDay();
        $jour = $aujourdhui->toDateString();

        if ($etat === CertificateState::Expired) {
            $requete->where('expires_on', '<', $jour);

            return;
        }

        $aRenouveler = function (Builder $q) use ($aujourdhui): void {
            foreach ($this->typesParDelai() as $delai => $ids) {
                $q->orWhere(fn (Builder $groupe): Builder => $groupe
                    ->whereIn('certificate_type_term_id', $ids)
                    ->where('expires_on', '<=', $aujourdhui->addDays($delai)->toDateString()));
            }
        };

        if ($etat === CertificateState::ToRenew) {
            $requete->where('expires_on', '>=', $jour)->where(fn (Builder $q) => $q->where($aRenouveler)->orWhereRaw('1 = 0'));

            return;
        }

        $requete->where(fn (Builder $q) => $q
            ->whereNull('expires_on')
            ->orWhere(fn (Builder $q2) => $q2->where('expires_on', '>=', $jour)->whereNot($aRenouveler)));
    }

    /**
     * @return array<int, list<string>>
     */
    private function typesParDelai(): array
    {
        $groupes = [];

        foreach (Certificate::query()->distinct()->pluck('certificate_type_term_id') as $id) {
            $groupes[$this->types->reminderDays($this->types->find((string) $id))][] = (string) $id;
        }

        return $groupes;
    }
}
