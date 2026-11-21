<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Queries;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Data\ActivityEntryData;
use App\Modules\Organizations\Data\ActivityFilters;
use App\Modules\Organizations\Data\ActivityPageData;
use App\Modules\Organizations\Enums\ActivityType;
use App\Modules\Organizations\Enums\ActivityView;
use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Organizations\Support\ActivityCatalog;
use App\Modules\Organizations\Support\ActivityRedactor;
use App\Shared\Audit\AuditLog;
use App\Shared\Audit\AuditLogBuilder;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Vue expurgée de `audit_logs` pour l'organisation courante (ADR 0038, décision 4). `audit_logs` n'a pas de portée d'organisation :
 * chaque requête passe par `scoped()`, qui pose le filtre d'organisation, la fenêtre d'affichage et les actions exclues.
 */
final readonly class OrganizationActivity
{
    private const array COLONNES_LISTE = ['id', 'occurred_at', 'action', 'actor_user_id', 'organization_id', 'subject_type', 'subject_id', 'route', 'ip', 'user_agent'];

    private const int PAGE_EXPORT = 500;

    public function __construct(private CurrentOrganization $contexte) {}

    public function list(ActivityFilters $filtres, ActivityView $vue): ActivityPageData
    {
        $page = $this->filtered($filtres)->select(self::COLONNES_LISTE)->newestFirst()->cursorPaginate($filtres->perPage);
        /** @var list<AuditLog> $lignes */
        $lignes = $page->getCollection()->all();

        return new ActivityPageData($this->hydrate($lignes, $vue), $page->hasMorePages(), $page->nextCursor()?->encode());
    }

    public function find(string $id): ActivityEntryData
    {
        $ligne = Str::isUuid($id) ? $this->scoped()->whereKey($id)->first() : null;

        return $this->hydrate([$ligne ?? throw ErrorCode::ActivityNotFound->problem()], ActivityView::Detail)[0];
    }

    public function count(ActivityFilters $filtres): int
    {
        return $this->filtered($filtres)->count();
    }

    /**
     * @param  callable(ActivityEntryData): void  $ligne
     */
    public function each(ActivityFilters $filtres, callable $ligne): void
    {
        $curseur = null;

        do {
            $page = $this->filtered($filtres)->select(self::COLONNES_LISTE)->newestFirst()->cursorPaginate(self::PAGE_EXPORT, cursor: $curseur);
            /** @var list<AuditLog> $lignes */
            $lignes = $page->getCollection()->all();

            foreach ($this->hydrate($lignes, ActivityView::Rows) as $entree) {
                $ligne($entree);
            }

            $curseur = $page->nextCursor();
        } while ($curseur !== null);
    }

    private function scoped(): AuditLogBuilder
    {
        /** @var AuditLogBuilder $requete */
        $requete = AuditLog::query();

        return $requete
            ->inOrganization($this->contexte->id())
            ->where('occurred_at', '>=', $this->fenetre()->format(PreciseTimestamp::FORMAT))
            ->where(function ($q): void {
                foreach (ActivityCatalog::EXCLUDED as $prefixe) {
                    $q->whereRaw("action not like ? escape '!'", [self::motif($prefixe.'*')]);
                }

                $q->orWhereIn('action', ActivityCatalog::EXCLUDED_EXCEPT);
            });
    }

    private function filtered(ActivityFilters $filtres): AuditLogBuilder
    {
        $debut = max($filtres->from, $this->fenetre());

        return $this->scoped()
            ->occurredBetween($debut, $filtres->to)
            ->when($filtres->actorId !== null, fn (AuditLogBuilder $q): AuditLogBuilder => $q->byActor((string) $filtres->actorId))
            ->when($filtres->subjectType !== null && $filtres->subjectId !== null, fn (AuditLogBuilder $q): AuditLogBuilder => $q->forSubject((string) $filtres->subjectType, (string) $filtres->subjectId))
            ->when($filtres->type, fn (AuditLogBuilder $q, ActivityType $type): AuditLogBuilder => $this->ofType($q, $type));
    }

    private function fenetre(): CarbonImmutable
    {
        return CarbonImmutable::now()->subMonths(max(1, (int) config('organizations.activity.retention_months')));
    }

    /**
     * Le type d'une action est celui du premier motif du catalogue qui lui correspond : un motif d'un autre type placé plus haut l'écarte.
     */
    private function ofType(AuditLogBuilder $requete, ActivityType $type): AuditLogBuilder
    {
        $motifs = ActivityCatalog::typePatterns();

        return $requete->where(function ($q) use ($motifs, $type): void {
            if ($type === ActivityType::Other) {
                foreach ($motifs as [$motif]) {
                    $q->whereRaw("action not like ? escape '!'", [self::motif($motif)]);
                }

                return;
            }

            foreach ($motifs as $rang => [$motif, $genre]) {
                if ($genre !== $type) {
                    continue;
                }

                $q->orWhere(function ($c) use ($motifs, $rang, $motif, $type): void {
                    $c->whereRaw("action like ? escape '!'", [self::motif($motif)]);

                    foreach (array_slice($motifs, 0, $rang) as [$avant, $autre]) {
                        if ($autre !== $type) {
                            $c->whereRaw("action not like ? escape '!'", [self::motif($avant)]);
                        }
                    }
                });
            }
        });
    }

    private static function motif(string $motif): string
    {
        return str_replace('*', '%', str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $motif));
    }

    /**
     * @param  list<AuditLog>  $lignes
     * @return list<ActivityEntryData>
     */
    private function hydrate(array $lignes, ActivityView $vue): array
    {
        $acteurs = array_values(array_unique(array_filter(array_map(fn (AuditLog $l): ?string => $l->actor_user_id, $lignes))));
        $noms = $acteurs === [] ? [] : User::withTrashed()->whereIn('id', $acteurs)->pluck('name', 'id')->all();
        $adhesions = $acteurs === [] ? [] : $this->adhesions($acteurs);

        return array_map(function (AuditLog $l) use ($vue, $noms, $adhesions): ActivityEntryData {
            [$genre, $nom, $actif] = $this->acteur($l, $noms, $adhesions);
            $membre = $genre === 'member';

            return new ActivityEntryData(
                id: $l->id,
                occurredAt: $l->occurred_at->utc(),
                action: $l->action,
                type: ActivityCatalog::typeOf($l->action),
                label: ActivityCatalog::label($l->action, $l->subject_type),
                actorKind: $genre,
                actorId: $membre ? $l->actor_user_id : null,
                actorName: $nom,
                actorActive: $actif,
                subjectType: $l->subject_type,
                subjectId: $l->subject_id,
                ip: $vue->discloses() && $membre ? ActivityRedactor::ip($l->ip) : null,
                device: $vue->discloses() && $membre ? ActivityRedactor::device($l->user_agent) : null,
                changes: $vue === ActivityView::Detail ? ActivityRedactor::changes($l->changes) : null,
                metadata: $vue === ActivityView::Detail ? ActivityRedactor::metadata($l->action, $l->metadata) : null,
                reference: $vue === ActivityView::Detail ? $l->request_id : null,
            );
        }, $lignes);
    }

    /**
     * @param  list<string>  $acteurs
     * @return array<string, bool> adhésion active par compte ; absent : aucune adhésion
     */
    private function adhesions(array $acteurs): array
    {
        $resultat = [];

        foreach (OrganizationMember::withTrashed()->whereIn('user_id', $acteurs)->get(['user_id', 'status', 'deleted_at']) as $membre) {
            $actif = ! $membre->trashed() && $membre->status === MemberStatus::Active;
            $resultat[(string) $membre->user_id] = ($resultat[(string) $membre->user_id] ?? false) || $actif;
        }

        return $resultat;
    }

    /**
     * @param  array<string, string>  $noms
     * @param  array<string, bool>  $adhesions
     * @return array{'member'|'tenant'|'owner'|'support'|'system'|'other', string|null, bool|null}
     */
    private function acteur(AuditLog $ligne, array $noms, array $adhesions): array
    {
        $route = (string) $ligne->route;

        return match (true) {
            $ligne->actor_user_id === null => ['system', 'Système', null],
            str_contains($route, '.console.'), str_starts_with($ligne->action, 'console.') => ['support', 'Support eGuardImmo', null],
            str_contains($route, '.tenant.') => ['tenant', 'Locataire', null],
            str_contains($route, '.owner.') => ['owner', 'Mandant', null],
            isset($adhesions[$ligne->actor_user_id]) => ['member', $noms[$ligne->actor_user_id] ?? null, $adhesions[$ligne->actor_user_id]],
            default => ['other', 'Autre compte', null],
        };
    }
}
