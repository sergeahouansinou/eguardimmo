<?php

declare(strict_types=1);

use App\Modules\Leases\Models\Lease;
use App\Modules\Properties\Models\Unit;
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
    $this->relais = L::lot($this->org);
    $this->fermer = fn (Lease $bail, string $ligne, array $corps) => $this->postJson(U::urlFermeture($this->org, $bail->id, $ligne), $corps);
    $this->avecAnnexe = function (bool $signe = true) {
        $bail = $signe ? U::signe($this->org, $this->lot) : U::brouillon($this->org, $this->lot);
        $ligne = R::occuper($this->org, $bail, $this->annexe, ['is_main' => false, 'valid_from' => '2026-03-01']);

        return [$bail, $ligne];
    };
});

it('ferme une annexe en cours de bail signé : valid_to exclu, version, réponse et journal', function (): void {
    [$bail, $annexe] = ($this->avecAnnexe)();

    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2026-09-01'))->assertOk()
        ->assertJsonPath('data.lock_version', 2)
        ->assertJsonPath('data.units.1.end_date', '2026-08-31');

    $audit = DB::table('audit_logs')->where('action', 'leases.unit.ended')->first();

    expect(U::lignes($bail))->toBe([
        "{$this->lot->id}|P|2026-01-01|-",
        "{$this->annexe->id}|A|2026-03-01|2026-09-01",
    ])
        ->and(U::version($bail))->toBe(2)
        ->and($audit?->subject_id)->toBe($bail->id)
        ->and($audit?->actor_user_id)->toBe($this->titulaire->id)
        ->and(json_decode((string) $audit?->metadata, true))->toMatchArray(['lease_unit_id' => $annexe->id, 'unit_id' => $this->annexe->id, 'valid_to' => '2026-09-01', 'replaced_by_unit_id' => null])
        ->and(DB::table('audit_logs')->where('subject_id', $annexe->id)->where('action', 'like', '%updated%')->count())->toBe(1)
        ->and(DB::table('lease_unit_locks')->count())->toBe(0);
});

it('ferme une annexe à la fin exacte du bail et la refuse au-delà ou avant son début', function (): void {
    [$bail, $annexe] = ($this->avecAnnexe)();

    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2029-01-02'))->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');
    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2026-03-01'))->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');
    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2026-02-01'))->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');
    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2029-01-01'))->assertOk();

    expect(U::version($bail))->toBe(2);
});

it('borne la fermeture au départ préavisé du bail', function (): void {
    [$bail, $annexe] = ($this->avecAnnexe)();
    DB::table('leases')->where('id', $bail->id)->update(['notice_departure_on' => '2027-06-01']);

    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2027-06-02'))->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');
    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2027-06-01'))->assertOk();
});

it('refuse de fermer deux fois la même ligne', function (): void {
    [$bail, $annexe] = ($this->avecAnnexe)();

    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2026-09-01'))->assertOk();
    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2026-10-01', ['lock_version' => 2]))->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');

    expect(U::lignes($bail)[1])->toBe("{$this->annexe->id}|A|2026-03-01|2026-09-01");
});

it('refuse de fermer le lot principal sans lot de remplacement', function (): void {
    [$bail] = ($this->avecAnnexe)();
    $principal = U::ligne($this->org, $bail, $this->lot);

    ($this->fermer)($bail, $principal->id, U::corpsFermeture($bail, '2026-09-01'))->assertUnprocessable()->assertJsonPath('code', 'lease_no_main_unit');

    expect(U::lignes($bail)[0])->toBe("{$this->lot->id}|P|2026-01-01|-")
        ->and(U::version($bail))->toBe(1)
        ->and(DB::table('audit_logs')->where('action', 'leases.unit.ended')->count())->toBe(0);
});

it('change de lot principal dans une même demande : fermeture puis nouveau principal sous verrou', function (): void {
    [$bail] = ($this->avecAnnexe)();
    $principal = U::ligne($this->org, $bail, $this->lot);

    ($this->fermer)($bail, $principal->id, U::corpsFermeture($bail, '2026-09-01', ['replace_with_unit_id' => $this->relais->id]))->assertOk()
        ->assertJsonPath('data.lock_version', 2)
        ->assertJsonCount(3, 'data.units');

    expect(U::lignes($bail))->toBe([
        "{$this->lot->id}|P|2026-01-01|2026-09-01",
        "{$this->annexe->id}|A|2026-03-01|-",
        "{$this->relais->id}|P|2026-09-01|-",
    ])
        ->and(DB::table('lease_units')->where('lease_id', $bail->id)->whereNotNull('main_of_lease')->count())->toBe(1)
        ->and(DB::table('lease_unit_locks')->where('unit_id', $this->relais->id)->value('last_value'))->toBe(1)
        ->and(json_decode((string) DB::table('audit_logs')->where('action', 'leases.unit.ended')->value('metadata'), true))->toMatchArray(['replaced_by_unit_id' => $this->relais->id])
        ->and(DB::table('audit_logs')->where('action', 'leases.unit.ended')->count())->toBe(1);
});

it('change de lot principal sur un brouillon sans verrou', function (): void {
    [$bail] = ($this->avecAnnexe)(false);
    $principal = U::ligne($this->org, $bail, $this->lot);

    ($this->fermer)($bail, $principal->id, U::corpsFermeture($bail, '2026-09-01', ['replace_with_unit_id' => $this->relais->id]))->assertOk();

    expect(U::lignes($bail))->toContain("{$this->relais->id}|P|2026-09-01|-")
        ->and(DB::table('lease_unit_locks')->count())->toBe(0);
});

it('refuse le remplacement par un lot occupé par un autre bail signé et annule la fermeture', function (): void {
    [$bail] = ($this->avecAnnexe)();
    U::signe($this->org, $this->relais, ['starts_on' => '2026-06-01', 'ends_on' => '2027-06-01']);
    $principal = U::ligne($this->org, $bail, $this->lot);

    ($this->fermer)($bail, $principal->id, U::corpsFermeture($bail, '2026-09-01', ['replace_with_unit_id' => $this->relais->id]))->assertConflict()->assertJsonPath('code', 'lease_overlap');

    expect(U::lignes($bail)[0])->toBe("{$this->lot->id}|P|2026-01-01|-")
        ->and(U::version($bail))->toBe(1)
        ->and(DB::table('lease_unit_locks')->where('unit_id', $this->relais->id)->count())->toBe(0);
});

it('voit l\'occupation concurrente du lot de remplacement après le verrou', function (): void {
    [$bail] = ($this->avecAnnexe)();
    $principal = U::ligne($this->org, $bail, $this->lot);

    $niveau = DB::transactionLevel();
    $declenchee = false;
    DB::listen(function ($requete) use (&$declenchee, $niveau): void {
        if ($declenchee || DB::transactionLevel() <= $niveau || ! str_contains($requete->sql, 'from "lease_unit_locks"')) {
            return;
        }

        $declenchee = true;
        S::insererBailSigne($this->org->id, $this->relais->id);
    });

    ($this->fermer)($bail, $principal->id, U::corpsFermeture($bail, '2026-09-01', ['replace_with_unit_id' => $this->relais->id]))->assertConflict()->assertJsonPath('code', 'lease_overlap');

    expect($declenchee)->toBeTrue()
        ->and(U::lignes($bail)[0])->toBe("{$this->lot->id}|P|2026-01-01|-");
});

it('prend le verrou du lot de remplacement avant de relire les occupations', function (): void {
    [$bail] = ($this->avecAnnexe)();
    $principal = U::ligne($this->org, $bail, $this->lot);

    $evenements = [];
    DB::listen(function ($requete) use (&$evenements): void {
        if (str_contains($requete->sql, 'insert into "lease_unit_locks"')) {
            $evenements[] = 'verrou:'.$requete->bindings[1];
        } elseif (str_contains($requete->sql, 'from "lease_units"') && str_contains($requete->sql, '"unit_id" in')) {
            $evenements[] = 'lecture';
        }
    });

    ($this->fermer)($bail, $principal->id, U::corpsFermeture($bail, '2026-09-01', ['replace_with_unit_id' => $this->relais->id]))->assertOk();

    expect($evenements)->toBe(["verrou:{$this->relais->id}", 'lecture']);
});

it('refuse un remplacement archivé, déjà rattaché au bail ou hors bail de l\'organisation', function (): void {
    [$bail] = ($this->avecAnnexe)();
    $principal = U::ligne($this->org, $bail, $this->lot);
    $autre = L::organisation();

    ($this->fermer)($bail, $principal->id, U::corpsFermeture($bail, '2026-09-01', ['replace_with_unit_id' => U::lotArchive($this->org)->id]))->assertUnprocessable()->assertJsonPath('code', 'lease_unit_not_available');
    ($this->fermer)($bail, $principal->id, U::corpsFermeture($bail, '2026-09-01', ['replace_with_unit_id' => $this->annexe->id]))->assertConflict()->assertJsonPath('code', 'lease_unit_conflict');
    ($this->fermer)($bail, $principal->id, U::corpsFermeture($bail, '2026-09-01', ['replace_with_unit_id' => L::lot($autre)->id]))->assertNotFound()->assertJsonPath('code', 'unit_not_found');

    expect(U::lignes($bail)[0])->toBe("{$this->lot->id}|P|2026-01-01|-")
        ->and(U::version($bail))->toBe(1);
});

it('refuse un remplacement qui commence à la fin du bail', function (): void {
    [$bail] = ($this->avecAnnexe)();
    $principal = U::ligne($this->org, $bail, $this->lot);

    ($this->fermer)($bail, $principal->id, U::corpsFermeture($bail, '2029-01-01', ['replace_with_unit_id' => $this->relais->id]))->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');
});

it('refuse un lot de remplacement pour une annexe', function (): void {
    [$bail, $annexe] = ($this->avecAnnexe)();

    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2026-09-01', ['replace_with_unit_id' => $this->relais->id]))->assertUnprocessable()->assertJsonValidationErrors(['replace_with_unit_id']);

    expect(U::version($bail))->toBe(1);
});

it('ferme une annexe d\'un brouillon', function (): void {
    [$bail, $annexe] = ($this->avecAnnexe)(false);

    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2026-09-01'))->assertOk();

    expect(U::lignes($bail)[1])->toBe("{$this->annexe->id}|A|2026-03-01|2026-09-01");
});

it('refuse une version périmée', function (): void {
    [$bail, $annexe] = ($this->avecAnnexe)();

    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2026-09-01', ['lock_version' => 5]))->assertConflict()->assertJsonPath('code', 'lease_stale_version');

    expect(U::lignes($bail)[1])->toBe("{$this->annexe->id}|A|2026-03-01|-");
});

it('refuse un bail terminé, annulé ou archivé', function (): void {
    [$termine, $a] = ($this->avecAnnexe)();
    U::fermer($this->org, $termine, 'terminated');
    [$archive, $b] = ($this->avecAnnexe)();
    U::fermer($this->org, $archive, 'signed', true);

    ($this->fermer)($termine, $a->id, U::corpsFermeture($termine, '2026-09-01'))->assertConflict()->assertJsonPath('code', 'lease_already_terminated');
    ($this->fermer)($archive, $b->id, U::corpsFermeture($archive, '2026-09-01'))->assertConflict()->assertJsonPath('code', 'lease_archived');

    expect(DB::table('lease_units')->whereIn('id', [$a->id, $b->id])->whereNotNull('valid_to')->count())->toBe(0);
});

it('refuse une ligne introuvable, d\'un autre bail ou d\'une autre organisation', function (): void {
    [$bail] = ($this->avecAnnexe)();
    [$autreBail, $autreLigne] = ($this->avecAnnexe)();
    $autre = L::organisation();
    $etranger = U::signe($autre);
    $ligneEtrangere = U::ligne($autre, $etranger, L::dans($autre, fn () => Unit::query()->firstOrFail()));

    ($this->fermer)($bail, fake()->uuid(), U::corpsFermeture($bail, '2026-09-01'))->assertNotFound()->assertJsonPath('code', 'lease_unit_not_found');
    ($this->fermer)($bail, $autreLigne->id, U::corpsFermeture($bail, '2026-09-01'))->assertNotFound()->assertJsonPath('code', 'lease_unit_not_found');
    ($this->fermer)($etranger, $ligneEtrangere->id, U::corpsFermeture($etranger, '2026-09-01'))->assertNotFound()->assertJsonPath('code', 'lease_not_found');

    expect(DB::table('lease_units')->whereNotNull('valid_to')->count())->toBe(0);
});

it('valide le corps et exige un jeton et l\'appartenance à l\'organisation', function (): void {
    [$bail, $annexe] = ($this->avecAnnexe)();
    $autre = L::organisation();

    $this->postJson(U::urlFermeture($this->org, $bail->id, $annexe->id), [])->assertUnprocessable()->assertJsonValidationErrors(['lock_version', 'valid_to']);
    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2026-09-01', ['replace_with_unit_id' => 'xx']))->assertUnprocessable()->assertJsonValidationErrors(['replace_with_unit_id']);

    R::changerDeCompte($this, L::titulaire($autre));
    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2026-09-01'))->assertNotFound()->assertJsonPath('code', 'organization_not_found');

    auth()->forgetGuards();
    ($this->fermer)($bail, $annexe->id, U::corpsFermeture($bail, '2026-09-01'))->assertUnauthorized();

    expect(DB::table('lease_units')->whereNotNull('valid_to')->count())->toBe(0);
});
