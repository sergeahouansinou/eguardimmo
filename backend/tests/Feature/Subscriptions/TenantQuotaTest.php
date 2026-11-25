<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Queries\TenantCounts;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Subscriptions\Enums\Feature;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Leases\LeaseDraftContext as D;
use Tests\Feature\Leases\LeasePartiesContext as PC;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesQueryTrace as T;
use Tests\Feature\Properties\PropertiesContext as P;
use Tests\Feature\Subscriptions\QuotaContext as Q;

beforeEach(function (): void {
    Mail::fake();
    Q::demarrer();
    $this->travelTo('2026-11-21 10:00:00');
    $this->org = Q::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->autre = Q::organisation();
    $this->autreTitulaire = L::titulaire($this->autre);
    Q::gratuit($this->org);
    Q::deroger($this->org, Feature::Leases, null);

    $this->compte = fn (?Organization $org = null): int => L::dans($org ?? $this->org, fn (): int => app(TenantCounts::class)->distinct());
    $this->bailAvec = function (array $partieIds, array $attributs = [], ?Organization $org = null): Lease {
        $org ??= $this->org;
        $bail = L::bail($org, $attributs);

        foreach ($partieIds as $id) {
            PC::ligne($org, $bail, ['party_id' => $id]);
        }

        return $bail;
    };
    $this->partie = fn (?Organization $org = null): string => L::partie($org ?? $this->org)->id;
    $this->lignes = fn (array $ids, string $role = 'tenant'): array => array_map(fn (string $id): array => ['party_id' => $id, 'role' => $role, 'joint_liability' => true], $ids);
    $this->creer = fn (array $parties, ?Organization $org = null, mixed $compte = null) => Q::comme($this, $compte ?? $this->titulaire)
        ->postJson(P::url($org ?? $this->org, '/leases'), D::payload(L::lot($org ?? $this->org), L::partie($org ?? $this->org), ['parties' => $parties]));
    $this->refuse = fn ($reponse, int $limite = 2, int $actuel = 2) => expect($reponse->assertStatus(409)->json())
        ->toMatchArray(['code' => 'plan_quota_reached', 'status' => 409, 'feature' => 'tenants', 'limit' => $limite, 'current' => $actuel]);
});

it('crée un bail dont le locataire tient sous la limite du plan', function (): void {
    ($this->bailAvec)([($this->partie)()]);

    ($this->creer)(($this->lignes)([($this->partie)()]))->assertCreated();

    expect(($this->compte)())->toBe(2);
});

it('refuse à la limite avec 409 plan_quota_reached, feature, limit et current, sans rien créer', function (): void {
    ($this->bailAvec)([($this->partie)(), ($this->partie)()]);
    $avant = L::dans($this->org, fn (): int => Lease::query()->count());

    ($this->refuse)(($this->creer)(($this->lignes)([($this->partie)()])));

    expect(L::dans($this->org, fn (): int => Lease::query()->count()))->toBe($avant)->and(($this->compte)())->toBe(2);
});

it('refuse un bail qui apporterait deux nouveaux locataires quand un seul tient', function (): void {
    ($this->bailAvec)([($this->partie)()]);

    ($this->refuse)(($this->creer)(($this->lignes)([($this->partie)(), ($this->partie)()])), 2, 1);
});

it('ne recompte pas un locataire déjà compté, même à la limite, et ne compte ni garant ni occupant', function (): void {
    $a = ($this->partie)();
    $b = ($this->partie)();
    ($this->bailAvec)([$a, $b]);

    ($this->creer)(($this->lignes)([$a]))->assertCreated();
    ($this->creer)(($this->lignes)([$a, $b]))->assertCreated();
    ($this->creer)([...($this->lignes)([$a]), ...($this->lignes)([($this->partie)()], 'guarantor'), ...($this->lignes)([($this->partie)()], 'occupant')])->assertCreated();

    expect(($this->compte)())->toBe(2);
    ($this->refuse)(($this->creer)(($this->lignes)([($this->partie)()])));
});

it('ne compte pas un bail terminé, annulé ou archivé, ni une ligne de locataire déjà close', function (): void {
    ($this->bailAvec)([($this->partie)()], ['status' => LeaseStatus::Terminated]);
    ($this->bailAvec)([($this->partie)()], ['status' => LeaseStatus::Cancelled]);
    ($this->bailAvec)([($this->partie)()], ['archived_at' => now()]);
    $parti = ($this->bailAvec)([]);
    PC::ligne($this->org, $parti, ['valid_to' => '2026-06-01']);
    PC::ligne($this->org, $parti, ['valid_to' => '2026-12-31']);

    expect(($this->compte)())->toBe(1);

    ($this->creer)(($this->lignes)([($this->partie)()]))->assertCreated();
    ($this->refuse)(($this->creer)(($this->lignes)([($this->partie)()])));
});

it('compte les baux signés comme les brouillons', function (): void {
    ($this->bailAvec)([($this->partie)(), ($this->partie)()], ['status' => LeaseStatus::Signed, 'signed_on' => '2026-01-01']);

    ($this->refuse)(($this->creer)(($this->lignes)([($this->partie)()])));
});

it('compte chaque organisation à part', function (): void {
    ($this->bailAvec)([($this->partie)(), ($this->partie)()]);
    ($this->bailAvec)([($this->partie)(), ($this->partie)(), ($this->partie)()], [], $this->autre);
    Q::deroger($this->autre, Feature::Leases, null);

    expect(($this->compte)())->toBe(2)->and(($this->compte)($this->autre))->toBe(3);
    ($this->refuse)(($this->creer)(($this->lignes)([($this->partie)()])));

    Q::gratuit($this->autre);
    ($this->creer)(($this->lignes)([($this->partie)($this->autre)]), $this->autre, $this->autreTitulaire)->assertStatus(409)->assertJsonPath('current', 3);
});

it('ne limite pas une organisation sans abonnement', function (): void {
    ($this->bailAvec)([($this->partie)(), ($this->partie)(), ($this->partie)()]);
    Q::sansAbonnement($this->org);

    ($this->creer)(($this->lignes)([($this->partie)()]))->assertCreated();
});

it('lève la limite par dérogation et refuse net une fonction désactivée', function (): void {
    ($this->bailAvec)([($this->partie)(), ($this->partie)()]);

    Q::deroger($this->org, Feature::Tenants, 3);
    ($this->creer)(($this->lignes)([($this->partie)()]))->assertCreated();
    ($this->refuse)(($this->creer)(($this->lignes)([($this->partie)()])), 3, 3);

    Q::deroger($this->org, Feature::Tenants, null, false);
    ($this->creer)(($this->lignes)([($this->partie)()]))->assertForbidden()->assertJsonPath('code', 'feature_not_in_plan')->assertJsonPath('feature', 'tenants');
});

it('ajout d\'une partie : refuse un nouveau locataire à la limite, accepte un locataire déjà compté, un garant et un occupant', function (): void {
    $a = ($this->partie)();
    ($this->bailAvec)([$a, ($this->partie)()]);
    $cible = L::bail($this->org, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01']);
    $this->actingAs($this->titulaire);

    PC::ajouter($this, $cible, ($this->partie)())->assertStatus(409)->assertJsonPath('code', 'plan_quota_reached')->assertJsonPath('feature', 'tenants')->assertJsonPath('limit', 2)->assertJsonPath('current', 2);
    expect(PC::lignes($this->org, $cible))->toBe([])->and(PC::version($this->org, $cible))->toBe(1);

    PC::ajouter($this, $cible, ($this->partie)(), 'guarantor')->assertCreated();
    PC::ajouter($this, $cible, ($this->partie)(), 'occupant')->assertCreated();
    PC::ajouter($this, $cible, $a)->assertCreated();

    expect(($this->compte)())->toBe(2);
});

it('ajout d\'une partie sur un bail terminé : l\'état du bail prime sur le plafond', function (): void {
    ($this->bailAvec)([($this->partie)(), ($this->partie)()]);
    $fini = L::bail($this->org, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01', 'status' => LeaseStatus::Terminated]);
    $this->actingAs($this->titulaire);

    PC::ajouter($this, $fini, ($this->partie)())->assertStatus(409)->assertJsonPath('code', 'lease_already_terminated');
});

it('modification d\'un brouillon : le remplacement des parties ne compte que les locataires nouveaux', function (): void {
    $b = ($this->partie)();
    $brouillon = ($this->bailAvec)([($this->partie)()]);
    ($this->bailAvec)([$b]);
    $modifier = fn (array $parties) => Q::comme($this, $this->titulaire)->patchJson(P::url($this->org, "/leases/{$brouillon->id}"), [
        'lock_version' => PC::version($this->org, $brouillon), 'parties' => ($this->lignes)($parties),
    ]);
    $c = ($this->partie)();
    $d = ($this->partie)();

    ($this->refuse)($modifier([$c, $d]));
    $modifier([$c])->assertOk();
    $modifier([$c, $b])->assertOk();
    ($this->refuse)($modifier([$c, $b, $d]), 2, 2);
    expect(($this->compte)())->toBe(2);
});

it('modification d\'un brouillon sans parties : jamais refusée par le plafond', function (): void {
    $brouillon = ($this->bailAvec)([($this->partie)(), ($this->partie)(), ($this->partie)()]);

    Q::comme($this, $this->titulaire)->patchJson(P::url($this->org, "/leases/{$brouillon->id}"), ['lock_version' => 1, 'note' => 'Sans effet sur les locataires'])->assertOk();
});

it('restauration : un bail archivé compte de nouveau ses locataires, sauf s\'il est terminé', function (): void {
    ($this->bailAvec)([($this->partie)(), ($this->partie)()]);
    $archive = ($this->bailAvec)([($this->partie)()], ['archived_at' => now()]);
    $termine = ($this->bailAvec)([($this->partie)()], ['archived_at' => now(), 'status' => LeaseStatus::Terminated]);
    $restaurer = fn (Lease $bail) => Q::comme($this, $this->titulaire)->deleteJson(P::url($this->org, "/leases/{$bail->id}/archive"));

    $restaurer($archive)->assertStatus(409)->assertJsonPath('code', 'plan_quota_reached')->assertJsonPath('feature', 'tenants')->assertJsonPath('current', 2);
    expect(L::dans($this->org, fn () => $archive->fresh()?->archived_at))->not->toBeNull();

    $restaurer($termine)->assertOk();
    Q::deroger($this->org, Feature::Tenants, 3);
    $restaurer($archive)->assertOk();
});

it('duplication : accepte quand les locataires copiés sont déjà comptés, refuse quand un bail terminé en ramène de nouveaux', function (): void {
    $a = ($this->partie)();
    $b = ($this->partie)();
    ($this->creer)(($this->lignes)([$a, $b]))->assertCreated();
    $source = L::dans($this->org, fn (): Lease => Lease::query()->firstOrFail());
    $dupliquer = fn (Lease $bail) => Q::comme($this, $this->titulaire)->postJson(P::url($this->org, "/leases/{$bail->id}/duplicate"), ['starts_on' => '2027-01-01']);

    $dupliquer($source)->assertCreated();
    expect(($this->compte)())->toBe(2);

    L::dans($this->org, fn (): int => Lease::query()->update(['status' => LeaseStatus::Terminated]));
    ($this->creer)(($this->lignes)([($this->partie)(), ($this->partie)()]))->assertCreated();
    $dupliquer($source)->assertStatus(409)->assertJsonPath('code', 'plan_quota_reached')->assertJsonPath('feature', 'tenants');
});

it('verrouille l\'abonnement avant le bail, à la création, à l\'ajout, à la modification et à la restauration', function (): void {
    $this->actingAs($this->titulaire);
    Q::deroger($this->org, Feature::Tenants, null);
    $verrou = fn (array $trace, string $table): int|false => array_find_key($trace, fn (array $e): bool => $e[0] === T::LOCKED_READ && str_contains($e[1], "from \"{$table}\""));
    $avant = function (callable $appel) use ($verrou): array {
        $trace = T::run($appel);

        return [$verrou($trace, 'subscriptions'), $verrou($trace, 'leases')];
    };

    $brouillon = ($this->bailAvec)([($this->partie)()]);
    $signe = L::bail($this->org, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01', 'status' => LeaseStatus::Signed, 'signed_on' => '2026-01-01']);
    $archive = ($this->bailAvec)([($this->partie)()], ['archived_at' => now()]);

    [$abonnement, $bail] = $avant(fn () => PC::ajouter($this, $signe, ($this->partie)()));
    expect($abonnement)->not->toBeFalse()->and($bail)->not->toBeFalse()->and($abonnement)->toBeLessThan($bail);

    [$abonnement, $bail] = $avant(fn () => Q::comme($this, $this->titulaire)->patchJson(P::url($this->org, "/leases/{$brouillon->id}"), [
        'lock_version' => PC::version($this->org, $brouillon), 'parties' => ($this->lignes)([($this->partie)()]),
    ])->assertOk());
    expect($abonnement)->not->toBeFalse()->and($bail)->not->toBeFalse()->and($abonnement)->toBeLessThan($bail);

    [$abonnement, $bail] = $avant(fn () => Q::comme($this, $this->titulaire)->deleteJson(P::url($this->org, "/leases/{$archive->id}/archive"))->assertOk());
    expect($abonnement)->not->toBeFalse()->and($bail)->not->toBeFalse()->and($abonnement)->toBeLessThan($bail);

    $trace = T::run(fn () => ($this->creer)(($this->lignes)([($this->partie)()]))->assertCreated());
    $ecriture = array_find_key($trace, fn (array $e): bool => $e[0] === T::WRITE && str_contains($e[1], 'into "leases"'));
    expect($verrou($trace, 'subscriptions'))->not->toBeFalse()->and($verrou($trace, 'subscriptions'))->toBeLessThan($ecriture);
});

it('refuse avant de verrouiller le bail quand le plafond est atteint', function (): void {
    ($this->bailAvec)([($this->partie)(), ($this->partie)()]);
    $cible = L::bail($this->org, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01']);
    $this->actingAs($this->titulaire);

    $trace = T::run(fn () => PC::ajouter($this, $cible, ($this->partie)())->assertStatus(409));

    expect(array_filter($trace, fn (array $e): bool => $e[0] === T::LOCKED_READ && str_contains($e[1], 'from "leases"')))->toBe([]);
});
