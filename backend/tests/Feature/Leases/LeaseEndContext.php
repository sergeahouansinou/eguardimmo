<?php

declare(strict_types=1);

namespace Tests\Feature\Leases;

use App\Modules\Leases\Actions\RecordNotice;
use App\Modules\Leases\Actions\RenewLease;
use App\Modules\Leases\Actions\TerminateLease;
use App\Modules\Leases\Data\NoticeData;
use App\Modules\Leases\Data\RenewalData;
use App\Modules\Leases\Data\TerminationData;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\NoticeGivenBy;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use App\Shared\Http\ApiProblem;
use Closure;

final class LeaseEndContext
{
    /**
     * Bail signé à terme fixe, avec un lot principal, un locataire et un loyer ouverts depuis le début.
     *
     * @param  array<string, mixed>  $attributs
     * @return array{bail: Lease, lot: Unit, locataire: Party, loyer: LeaseTerm}
     */
    public static function bail(Organization $organisation, array $attributs = [], ?Unit $lot = null): array
    {
        $bail = LeasesReadContext::bailSigne($organisation, [
            'starts_on' => '2026-01-01', 'duration_months' => 36, 'tacit_renewal' => false, 'ends_on' => '2029-01-01', ...$attributs,
        ]);
        $lot ??= LeasesContext::lot($organisation);
        $locataire = LeasesContext::partie($organisation);

        LeasesReadContext::occuper($organisation, $bail, $lot, ['valid_from' => $bail->starts_on->toDateString()]);
        LeasesReadContext::lier($organisation, $bail, $locataire, ['valid_from' => $bail->starts_on->toDateString()]);
        $loyer = LeasesReadContext::terme($organisation, $bail, 'rent', [...LeasesReadContext::loyer(65000), 'valid_from' => $bail->starts_on->toDateString()]);

        return ['bail' => $bail, 'lot' => $lot, 'locataire' => $locataire, 'loyer' => $loyer];
    }

    /**
     * @param  array<string, mixed>  $s
     */
    public static function preavis(Lease $bail, array $s = []): NoticeData
    {
        return new NoticeData(
            lockVersion: $s['version'] ?? $bail->lock_version,
            givenBy: $s['par'] ?? NoticeGivenBy::Tenant,
            receivedOn: $s['recu'] ?? '2026-11-10',
            departureOn: $s['depart'] ?? null,
            terminationReason: $s['motif'] ?? 'Mutation professionnelle',
            replace: $s['remplace'] ?? false,
        );
    }

    /**
     * @param  array<string, mixed>  $s
     */
    public static function fin(Lease $bail, array $s = []): TerminationData
    {
        return new TerminationData(
            lockVersion: $s['version'] ?? $bail->lock_version,
            endsOn: $s['fin'] ?? null,
            amicable: $s['amiable'] ?? false,
            terminationReason: $s['motif'] ?? null,
            requestedBy: $s['par'] ?? null,
        );
    }

    /**
     * @param  array<string, mixed>  $s
     */
    public static function renouvellement(Lease $bail, array $s = []): RenewalData
    {
        return new RenewalData($s['version'] ?? $bail->lock_version, $s['mois'] ?? null, $s['changements'] ?? []);
    }

    public static function poser(Organization $organisation, Lease $bail, NoticeData $donnees): Lease
    {
        return LeasesContext::dans($organisation, fn (): Lease => app(RecordNotice::class)->handle($bail, $donnees));
    }

    public static function resilier(Organization $organisation, Lease $bail, TerminationData $donnees): Lease
    {
        return LeasesContext::dans($organisation, fn (): Lease => app(TerminateLease::class)->handle($bail, $donnees));
    }

    public static function renouveler(Organization $organisation, Lease $bail, RenewalData $donnees, ?string $acteur = null): Lease
    {
        return LeasesContext::dans($organisation, fn (): Lease => app(RenewLease::class)->handle($bail, $donnees, $acteur));
    }

    public static function relire(Organization $organisation, Lease $bail): Lease
    {
        return LeasesContext::dans($organisation, fn (): Lease => Lease::query()->findOrFail($bail->id));
    }

    /**
     * @return array{status: string, version: int, given_by: string|null, received_on: string|null, departure_on: string|null, reason: string|null, ends_on: string|null}
     */
    public static function champs(Organization $organisation, Lease $bail): array
    {
        $b = self::relire($organisation, $bail);

        return [
            'status' => $b->status->value,
            'version' => $b->lock_version,
            'given_by' => $b->notice_given_by?->value,
            'received_on' => $b->notice_received_on?->toDateString(),
            'departure_on' => $b->notice_departure_on?->toDateString(),
            'reason' => $b->termination_reason,
            'ends_on' => $b->ends_on?->toDateString(),
        ];
    }

    public static function statut(Organization $organisation, Lease $bail, LeaseStatus $statut): void
    {
        LeasesContext::dans($organisation, fn (): bool => Lease::query()->whereKey($bail->id)->update(['status' => $statut->value]) > 0);
    }

    /**
     * @return array{units: list<array{from: string, to: string|null}>, parties: list<array{from: string, to: string|null}>, terms: list<array{from: string, to: string|null}>}
     */
    public static function lignes(Organization $organisation, Lease $bail): array
    {
        return LeasesContext::dans($organisation, fn (): array => [
            'units' => self::periodes(LeaseUnit::query()->where('lease_id', $bail->id)->orderBy('valid_from')->orderBy('id')->get()->all()),
            'parties' => self::periodes(LeaseParty::query()->where('lease_id', $bail->id)->orderBy('valid_from')->orderBy('id')->get()->all()),
            'terms' => self::periodes(LeaseTerm::query()->where('lease_id', $bail->id)->orderBy('valid_from')->orderBy('id')->get()->all()),
        ]);
    }

    /**
     * Le code et le statut HTTP de la règle métier qui refuse l'appel ; l'appel ne doit rien avoir écrit.
     *
     * @param  Closure(): mixed  $appel
     */
    public static function refus(Closure $appel, string $code, int $statut): void
    {
        try {
            $appel();
            $erreur = null;
        } catch (ApiProblem $probleme) {
            $erreur = $probleme;
        }

        expect($erreur)->not->toBeNull()
            ->and($erreur?->problemCode)->toBe($code)
            ->and($erreur?->status)->toBe($statut);
    }

    /**
     * @param  list<LeaseUnit|LeaseParty|LeaseTerm>  $lignes
     * @return list<array{from: string, to: string|null}>
     */
    private static function periodes(array $lignes): array
    {
        $periodes = array_map(fn (LeaseUnit|LeaseParty|LeaseTerm $l): array => ['from' => $l->valid_from->toDateString(), 'to' => $l->valid_to?->toDateString()], $lignes);
        usort($periodes, fn (array $a, array $b): int => [$a['from'], $a['to'] ?? '9999-12-31'] <=> [$b['from'], $b['to'] ?? '9999-12-31']);

        return $periodes;
    }
}
