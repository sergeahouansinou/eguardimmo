<?php

declare(strict_types=1);

use App\Modules\Leases\Models\Lease;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseSignContext as S;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Leases\LeaseUnitsContext as U;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->actingAs($this->titulaire);
    $this->lot = L::lot($this->org);
    $this->annexe = L::lot($this->org);
    $this->ajouter = fn (Lease $bail, array $corps, ?Lease $cible = null) => $this->postJson(U::urlAjout($this->org, ($cible ?? $bail)->id), $corps);
});

it('ajoute une annexe en cours de bail signé sous verrou du lot : ligne, version, verrou, réponse et journal', function (): void {
    $bail = U::signe($this->org, $this->lot);

    $reponse = ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe))->assertCreated()
        ->assertJsonPath('data.id', $bail->id)
        ->assertJsonPath('data.lock_version', 2)
        ->assertJsonCount(2, 'data.units');

    expect(U::lignes($bail))->toBe([
        "{$this->lot->id}|P|2026-01-01|-",
        "{$this->annexe->id}|A|2026-06-01|-",
    ])
        ->and(U::version($bail))->toBe(2)
        ->and(DB::table('lease_unit_locks')->where('unit_id', $this->annexe->id)->value('last_value'))->toBe(1)
        ->and(DB::table('lease_unit_locks')->where('unit_id', $this->lot->id)->count())->toBe(0);

    $audit = DB::table('audit_logs')->where('action', 'leases.unit.added')->first();
    $ligne = DB::table('lease_units')->where('lease_id', $bail->id)->where('unit_id', $this->annexe->id)->first();

    expect($audit)->not->toBeNull()
        ->and($audit->subject_id)->toBe($bail->id)
        ->and($audit->organization_id)->toBe($this->org->id)
        ->and($audit->actor_user_id)->toBe($this->titulaire->id)
        ->and(json_decode((string) $audit->metadata, true))->toMatchArray(['lease_unit_id' => $ligne->id, 'unit_id' => $this->annexe->id, 'is_main' => false, 'valid_from' => '2026-06-01'])
        ->and(DB::table('audit_logs')->where('subject_id', $ligne->id)->where('action', 'like', '%created%')->count())->toBe(1)
        ->and($reponse->json('data.units.1.is_main'))->toBeFalse();
});

it('ajoute une annexe à un brouillon sans verrou ni contrôle d\'occupation', function (): void {
    $bail = U::brouillon($this->org, $this->lot);

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['valid_from' => '2026-01-01']))->assertCreated()->assertJsonPath('data.lock_version', 2);

    expect(U::lignes($bail))->toContain("{$this->annexe->id}|A|2026-01-01|-")
        ->and(DB::table('lease_unit_locks')->count())->toBe(0);
});

it('admet un brouillon dont le lot est déjà occupé par un bail signé', function (): void {
    U::signe($this->org, $this->annexe);
    $bail = U::brouillon($this->org, $this->lot);

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe))->assertCreated();

    expect(U::lignes($bail))->toContain("{$this->annexe->id}|A|2026-06-01|-");
});

it('n\'accepte qu\'un lot principal ouvert par bail', function (): void {
    $bail = U::signe($this->org, $this->lot);

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['is_main' => true]))->assertConflict()->assertJsonPath('code', 'lease_main_unit_conflict');

    expect(U::lignes($bail))->toBe(["{$this->lot->id}|P|2026-01-01|-"])
        ->and(U::version($bail))->toBe(1)
        ->and(DB::table('lease_unit_locks')->count())->toBe(0);
});

it('refuse un second principal sur un brouillon', function (): void {
    $bail = U::brouillon($this->org, $this->lot);

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['is_main' => true]))->assertConflict()->assertJsonPath('code', 'lease_main_unit_conflict');
});

it('refuse un principal qui recoupe un principal déjà fermé après son début', function (): void {
    $bail = U::signe($this->org, $this->lot);
    DB::table('lease_units')->where('lease_id', $bail->id)->update(['valid_to' => '2026-09-01']);

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['is_main' => true, 'valid_from' => '2026-06-01']))->assertConflict()->assertJsonPath('code', 'lease_main_unit_conflict');
    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['is_main' => true, 'valid_from' => '2026-09-01']))->assertCreated();

    expect(DB::table('lease_units')->where('lease_id', $bail->id)->whereNotNull('main_of_lease')->count())->toBe(1);
});

it('refuse deux fois le même lot sur des périodes qui se recoupent', function (): void {
    $bail = U::signe($this->org, $this->lot);

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->lot, ['valid_from' => '2026-06-01']))->assertConflict()->assertJsonPath('code', 'lease_unit_conflict');
    ($this->ajouter)($bail, U::corpsAjout($bail, $this->lot, ['is_main' => true, 'valid_from' => '2026-06-01']))->assertConflict()->assertJsonPath('code', 'lease_unit_conflict');

    expect(U::lignes($bail))->toBe(["{$this->lot->id}|P|2026-01-01|-"])
        ->and(U::version($bail))->toBe(1);
});

it('admet de rattacher à nouveau un lot après la fermeture de sa ligne précédente, pas avant', function (): void {
    $bail = U::signe($this->org, $this->lot);
    R::occuper($this->org, $bail, $this->annexe, ['is_main' => false, 'valid_from' => '2026-03-01', 'valid_to' => '2026-06-01']);

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['valid_from' => '2026-05-31']))->assertConflict()->assertJsonPath('code', 'lease_unit_conflict');
    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['valid_from' => '2026-06-01']))->assertCreated();

    expect(DB::table('lease_units')->where('lease_id', $bail->id)->where('unit_id', $this->annexe->id)->count())->toBe(2);
});

it('refuse un lot archivé, d\'un autre pays ou d\'une autre organisation', function (): void {
    $bail = U::signe($this->org, $this->lot);
    $autre = L::organisation();

    ($this->ajouter)($bail, U::corpsAjout($bail, U::lotArchive($this->org)))->assertUnprocessable()->assertJsonPath('code', 'lease_unit_not_available');
    ($this->ajouter)($bail, U::corpsAjout($bail, U::lotDuPays($this->org, 'BE')))->assertUnprocessable()->assertJsonPath('code', 'lease_unit_not_available');
    ($this->ajouter)($bail, U::corpsAjout($bail, L::lot($autre)))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['unit_id' => fake()->uuid()]))->assertNotFound()->assertJsonPath('code', 'unit_not_found');

    expect(U::lignes($bail))->toBe(["{$this->lot->id}|P|2026-01-01|-"])
        ->and(U::version($bail))->toBe(1);
});

it('refuse un lot déjà occupé par un autre bail signé sur la période et annule tout', function (): void {
    U::signe($this->org, $this->annexe, ['starts_on' => '2026-03-01', 'ends_on' => '2027-03-01']);
    $bail = U::signe($this->org, $this->lot);

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['valid_from' => '2026-06-01']))->assertConflict()->assertJsonPath('code', 'lease_overlap');

    expect(U::lignes($bail))->toBe(["{$this->lot->id}|P|2026-01-01|-"])
        ->and(U::version($bail))->toBe(1)
        ->and(DB::table('lease_unit_locks')->where('unit_id', $this->annexe->id)->count())->toBe(0)
        ->and(DB::table('audit_logs')->where('action', 'leases.unit.added')->count())->toBe(0);
});

it('admet un lot dont l\'autre bail signé finit avant le début du rattachement', function (): void {
    U::signe($this->org, $this->annexe, ['starts_on' => '2025-01-01', 'ends_on' => '2026-06-01']);
    $bail = U::signe($this->org, $this->lot);

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['valid_from' => '2026-06-01']))->assertCreated();
    ($this->ajouter)($bail, U::corpsAjout($bail, L::lot($this->org), ['valid_from' => '2026-06-01', 'lock_version' => 2]))->assertCreated();
});

it('ne tient pas compte d\'un autre bail en brouillon ni annulé', function (): void {
    U::brouillon($this->org, $this->annexe);
    $annule = U::signe($this->org, $this->annexe);
    U::fermer($this->org, $annule, 'cancelled');
    $bail = U::signe($this->org, $this->lot);

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe))->assertCreated();
});

it('prend le verrou du lot avant de relire les occupations', function (): void {
    $bail = U::signe($this->org, $this->lot);

    $evenements = [];
    DB::listen(function ($requete) use (&$evenements): void {
        if (str_contains($requete->sql, 'insert into "lease_unit_locks"')) {
            $evenements[] = 'verrou:'.$requete->bindings[1];
        } elseif (str_contains($requete->sql, 'from "lease_units"') && str_contains($requete->sql, '"unit_id" in')) {
            $evenements[] = 'lecture';
        }
    });

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe))->assertCreated();

    expect($evenements)->toBe(["verrou:{$this->annexe->id}", 'lecture']);
});

it('voit l\'occupation concurrente validée entre le verrou et la relecture', function (): void {
    $bail = U::signe($this->org, $this->lot);

    $niveau = DB::transactionLevel();
    $declenchee = false;
    DB::listen(function ($requete) use (&$declenchee, $niveau): void {
        if ($declenchee || DB::transactionLevel() <= $niveau || ! str_contains($requete->sql, 'from "lease_unit_locks"')) {
            return;
        }

        $declenchee = true;
        S::insererBailSigne($this->org->id, $this->annexe->id);
    });

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe))->assertConflict()->assertJsonPath('code', 'lease_overlap');

    expect($declenchee)->toBeTrue()
        ->and(U::lignes($bail))->toBe(["{$this->lot->id}|P|2026-01-01|-"])
        ->and(U::version($bail))->toBe(1)
        ->and(DB::table('lease_unit_locks')->where('unit_id', $this->annexe->id)->count())->toBe(0);
});

it('ajoute sans conflit quand rien n\'arrive entre le verrou et la relecture', function (): void {
    $bail = U::signe($this->org, $this->lot);

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe))->assertCreated();

    expect(DB::table('lease_unit_locks')->where('unit_id', $this->annexe->id)->value('last_value'))->toBe(1);
});

it('refuse une version périmée', function (): void {
    $bail = U::signe($this->org, $this->lot);

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['lock_version' => 7]))->assertConflict()->assertJsonPath('code', 'lease_stale_version');
    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe))->assertCreated();
    ($this->ajouter)($bail, U::corpsAjout($bail, L::lot($this->org)))->assertConflict()->assertJsonPath('code', 'lease_stale_version');

    expect(U::version($bail))->toBe(2);
});

it('refuse un bail terminé, annulé ou archivé', function (): void {
    $termine = U::signe($this->org, $this->lot);
    U::fermer($this->org, $termine, 'terminated');
    $annule = U::signe($this->org, L::lot($this->org));
    U::fermer($this->org, $annule, 'cancelled');
    $archive = U::brouillon($this->org, L::lot($this->org));
    U::fermer($this->org, $archive, 'draft', true);

    ($this->ajouter)($termine, U::corpsAjout($termine, $this->annexe))->assertConflict()->assertJsonPath('code', 'lease_already_terminated');
    ($this->ajouter)($annule, U::corpsAjout($annule, $this->annexe))->assertConflict()->assertJsonPath('code', 'lease_already_terminated');
    ($this->ajouter)($archive, U::corpsAjout($archive, $this->annexe))->assertConflict()->assertJsonPath('code', 'lease_archived');

    expect(DB::table('lease_units')->where('unit_id', $this->annexe->id)->count())->toBe(0);
});

it('borne le début du rattachement à la vie du bail', function (): void {
    $bail = U::signe($this->org, $this->lot);
    DB::table('leases')->where('id', $bail->id)->update(['notice_departure_on' => '2027-06-01']);

    foreach (['2025-12-31', '2027-06-01', '2029-01-01'] as $debut) {
        ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['valid_from' => $debut]))->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');
    }

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['valid_from' => '2027-05-31']))->assertCreated();
    ($this->ajouter)($bail, U::corpsAjout($bail, L::lot($this->org), ['valid_from' => '2026-01-01', 'lock_version' => 2]))->assertCreated();
});

it('valide le corps de la requête', function (): void {
    $bail = U::signe($this->org, $this->lot);

    $this->postJson(U::urlAjout($this->org, $bail->id), [])->assertUnprocessable()->assertJsonValidationErrors(['lock_version', 'unit_id', 'valid_from']);
    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe, ['unit_id' => 'pas-un-uuid', 'valid_from' => '01/06/2026', 'is_main' => 'peut-etre']))
        ->assertUnprocessable()->assertJsonValidationErrors(['unit_id', 'valid_from', 'is_main']);
});

it('refuse un bail introuvable, d\'une autre organisation ou sans jeton', function (): void {
    $autre = L::organisation();
    $etranger = U::signe($autre);
    $bail = U::signe($this->org, $this->lot);

    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe), cible: (new Lease)->forceFill(['id' => fake()->uuid()]))->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    ($this->ajouter)($etranger, U::corpsAjout($etranger, $this->annexe))->assertNotFound()->assertJsonPath('code', 'lease_not_found');

    R::changerDeCompte($this, L::titulaire($autre));
    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe))->assertNotFound()->assertJsonPath('code', 'organization_not_found');

    auth()->forgetGuards();
    ($this->ajouter)($bail, U::corpsAjout($bail, $this->annexe))->assertUnauthorized();

    expect(DB::table('lease_units')->where('unit_id', $this->annexe->id)->count())->toBe(0);
});
