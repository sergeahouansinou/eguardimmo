<?php

declare(strict_types=1);

use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Events\LeaseSigned;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseUnit;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseSignContext as S;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    Storage::fake('documents');
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs($this->titulaire);
});

it('signe un brouillon complet : statut, date, fin calculée, version, journal et événement', function (): void {
    Event::fake([LeaseSigned::class]);
    ['bail' => $bail] = S::brouillon($this->org);

    $reponse = $this->postJson(S::url($this, $bail->id), S::corps($bail))->assertOk()
        ->assertJsonPath('data.id', $bail->id)
        ->assertJsonPath('data.status', 'signed')
        ->assertJsonPath('data.signed_on', '2026-11-10')
        ->assertJsonPath('data.end_date', '2028-12-31');

    $ligne = DB::table('leases')->where('id', $bail->id)->first();
    $audit = DB::table('audit_logs')->where('action', 'leases.lease.signed')->first();

    expect($reponse->json('data.id'))->toBe($bail->id)
        ->and($ligne->status)->toBe('signed')
        ->and($ligne->lock_version)->toBe(2)
        ->and($ligne->signed_file_id)->toBeNull()
        ->and($audit)->not->toBeNull()
        ->and($audit->subject_id)->toBe($bail->id)
        ->and($audit->organization_id)->toBe($this->org->id)
        ->and($audit->actor_user_id)->toBe($this->titulaire->id)
        ->and(DB::table('audit_logs')->where('subject_id', $bail->id)->where('action', 'like', '%updated%')->count())->toBeGreaterThanOrEqual(1);

    Event::assertDispatchedTimes(LeaseSigned::class, 1);
    Event::assertDispatched(LeaseSigned::class, fn (LeaseSigned $e): bool => $e->leaseId === $bail->id && $e->organizationId === $this->org->id);
});

it('ne laisse que des identifiants dans l\'événement', function (): void {
    $proprietes = array_map(fn (ReflectionProperty $p): string => (string) $p->getType(), (new ReflectionClass(LeaseSigned::class))->getProperties());

    expect($proprietes)->toBe(['string', 'string']);
});

it('n\'émet l\'événement qu\'après le commit de la transaction englobante', function (): void {
    $vus = [];
    Event::listen(LeaseSigned::class, function (LeaseSigned $e) use (&$vus): void {
        $vus[] = DB::transactionLevel();
    });
    ['bail' => $bail] = S::brouillon($this->org);
    $niveau = DB::transactionLevel();

    DB::transaction(function () use ($bail, &$vus): void {
        S::appliquer($this, $bail);

        expect($vus)->toBe([]);
    });

    expect($vus)->toBe([$niveau]);
});

it('n\'émet rien quand la signature est refusée', function (): void {
    Event::fake([LeaseSigned::class]);
    ['bail' => $bail] = S::brouillon($this->org);
    S::retirer($this->org, $bail, 'terms');

    expect(fn () => S::appliquer($this, $bail))->toThrow(ApiProblem::class);

    Event::assertNotDispatched(LeaseSigned::class);
});

it('garde ends_on vide pour un bail à reconduction tacite : occupation ouverte', function (): void {
    ['bail' => $bail] = S::brouillon($this->org, ['tacit_renewal' => true, 'ends_on' => '2029-01-01']);

    $signe = S::appliquer($this, $bail);

    expect($signe->ends_on)->toBeNull()
        ->and(DB::table('leases')->where('id', $bail->id)->value('ends_on'))->toBeNull();
});

it('calcule ends_on pour un bail sans reconduction, sans déborder en fin de mois', function (): void {
    ['bail' => $court] = S::brouillon($this->org, ['starts_on' => '2026-01-31', 'duration_months' => 1]);
    ['bail' => $long] = S::brouillon($this->org, ['starts_on' => '2026-03-01', 'duration_months' => 12]);

    expect(S::appliquer($this, $court)->ends_on?->toDateString())->toBe('2026-02-28')
        ->and(S::appliquer($this, $long)->ends_on?->toDateString())->toBe('2027-03-01');
});

it('enregistre le fichier signé de la même organisation', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);
    $fichier = L::dans($this->org, fn () => app(DocumentStore::class)->store(FileSource::contents("%PDF-1.4\n% bail signé\n"), 'Bail signé.pdf', FileCategory::Supporting));

    $this->postJson(S::url($this, $bail->id), S::corps($bail, ['signed_file_id' => $fichier->id]))->assertOk();

    expect(DB::table('leases')->where('id', $bail->id)->value('signed_file_id'))->toBe($fichier->id);
});

it('refuse un fichier inconnu ou d\'une autre organisation', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);
    $autre = L::organisation();
    $etranger = L::dans($autre, fn () => app(DocumentStore::class)->store(FileSource::contents("%PDF-1.4\n% autre\n"), 'Autre.pdf', FileCategory::Supporting));

    foreach ([fake()->uuid(), $etranger->id] as $id) {
        $this->postJson(S::url($this, $bail->id), S::corps($bail, ['signed_file_id' => $id]))
            ->assertUnprocessable()->assertJsonPath('code', 'lease_signature_invalid');
    }

    expect(DB::table('leases')->where('id', $bail->id)->value('status'))->toBe('draft');
});

it('refuse une date de signature future, mal formée ou absurde', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);

    foreach (['2026-11-17', '2027-01-01', '16/11/2026', 'demain', '1999-12-31', ''] as $date) {
        $this->postJson(S::url($this, $bail->id), S::corps($bail, ['signed_on' => $date]))->assertUnprocessable()->assertJsonValidationErrors('signed_on');
    }

    $this->postJson(S::url($this, $bail->id), S::corps($bail, ['signed_on' => '2026-11-16']))->assertOk();
});

it('refuse une date future aussi en dehors de la requête HTTP', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);

    expect(fn () => S::appliquer($this, $bail, date: '2026-11-17'))->toThrow(fn (ApiProblem $p): bool => $p->problemCode === 'lease_signature_invalid');
});

it('valide lock_version et refuse un champ de statut venu du client', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);

    foreach ([0, 'x', null] as $version) {
        $this->postJson(S::url($this, $bail->id), S::corps($bail, ['lock_version' => $version]))->assertUnprocessable()->assertJsonValidationErrors('lock_version');
    }

    $this->postJson(S::url($this, $bail->id), S::corps($bail, ['status' => 'terminated', 'organization_id' => fake()->uuid(), 'ends_on' => '2030-01-01']))->assertOk()
        ->assertJsonPath('data.status', 'signed')->assertJsonPath('data.end_date', '2028-12-31');

    expect(DB::table('leases')->where('id', $bail->id)->value('organization_id'))->toBe($this->org->id);
});

it('refuse un bail déjà signé, annulé ou archivé', function (): void {
    ['bail' => $signe] = S::brouillon($this->org);
    S::appliquer($this, $signe);
    $annule = L::bail($this->org, ['status' => LeaseStatus::Cancelled]);
    ['bail' => $archive] = S::brouillon($this->org);
    L::dans($this->org, fn () => Lease::query()->whereKey($archive->id)->first()?->forceFill(['archived_at' => now()])->save());

    $this->postJson(S::url($this, $signe->id), S::corps($signe, ['lock_version' => 2]))->assertConflict()->assertJsonPath('code', 'lease_not_draft');
    $this->postJson(S::url($this, $annule->id), S::corps($annule))->assertConflict()->assertJsonPath('code', 'lease_not_draft');
    $this->postJson(S::url($this, $archive->id), S::corps($archive, ['lock_version' => $archive->lock_version + 1]))->assertConflict()->assertJsonPath('code', 'lease_archived');
});

it('refuse un bail introuvable, d\'une autre organisation ou sans jeton', function (): void {
    $autre = L::organisation();
    ['bail' => $etranger] = S::brouillon($autre);
    ['bail' => $bail] = S::brouillon($this->org);

    $this->postJson(S::url($this, fake()->uuid()), S::corps($bail))->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    $this->postJson(S::url($this, $etranger->id), S::corps($etranger))->assertNotFound()->assertJsonPath('code', 'lease_not_found');

    R::changerDeCompte($this, L::titulaire($autre));
    $this->postJson(S::url($this, $bail->id), S::corps($bail))->assertNotFound()->assertJsonPath('code', 'organization_not_found');

    auth()->forgetGuards();
    $this->postJson(S::url($this, $bail->id), S::corps($bail))->assertUnauthorized();

    expect(DB::table('leases')->whereIn('id', [$bail->id, $etranger->id])->where('status', 'draft')->count())->toBe(2);
});

it('refuse une version périmée', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);

    $this->postJson(S::url($this, $bail->id), S::corps($bail, ['lock_version' => 7]))->assertConflict()->assertJsonPath('code', 'lease_stale_version');

    expect(DB::table('leases')->where('id', $bail->id)->value('status'))->toBe('draft');
});

it('refuse un bail sans lot principal ouvert', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);
    L::dans($this->org, fn () => LeaseUnit::query()->where('lease_id', $bail->id)->get()->each->update(['is_main' => false]));

    S::refus($this, $bail, 'lease_no_main_unit', 422);
});

it('refuse un bail sans lot du tout, et un lot principal fermé', function (): void {
    ['bail' => $sans] = S::brouillon($this->org);
    S::retirer($this->org, $sans, 'units');
    ['bail' => $ferme] = S::brouillon($this->org);
    L::dans($this->org, fn () => LeaseUnit::query()->where('lease_id', $ferme->id)->get()->each->update(['valid_to' => '2026-06-01']));

    S::refus($this, $sans, 'lease_no_main_unit', 422);
    S::refus($this, $ferme, 'lease_no_main_unit', 422);
});

it('refuse un bail sans locataire ouvert : garant seul ou locataire parti', function (): void {
    ['bail' => $sans] = S::brouillon($this->org);
    S::retirer($this->org, $sans, 'parties');
    R::lier($this->org, $sans, L::partie($this->org), ['role' => LeasePartyRole::Guarantor]);
    ['bail' => $parti] = S::brouillon($this->org);
    L::dans($this->org, fn () => LeaseParty::query()->where('lease_id', $parti->id)->get()->each->update(['valid_to' => '2026-06-01']));

    S::refus($this, $sans, 'lease_no_tenant', 422);
    S::refus($this, $parti, 'lease_no_tenant', 422);
});

it('refuse un bail sans ligne de loyer en vigueur au début : autre composante, loyer futur ou clos', function (): void {
    ['bail' => $charges] = S::brouillon($this->org);
    S::retirer($this->org, $charges, 'terms');
    R::terme($this->org, $charges, 'charges_provision', R::loyer(8000));
    ['bail' => $futur] = S::brouillon($this->org);
    S::retirer($this->org, $futur, 'terms');
    R::terme($this->org, $futur, 'rent', [...R::loyer(65000), 'valid_from' => '2026-02-01']);
    ['bail' => $clos] = S::brouillon($this->org);
    S::retirer($this->org, $clos, 'terms');
    R::terme($this->org, $clos, 'rent', [...R::loyer(65000), 'valid_to' => '2026-01-01']);
    ['bail' => $nu] = S::brouillon($this->org);
    S::retirer($this->org, $nu, 'terms');

    foreach ([$charges, $futur, $clos, $nu] as $bail) {
        S::refus($this, $bail, 'lease_no_rent', 422);
    }
});

it('accepte un loyer fractionné en deux lignes dont une couvre le début', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);
    S::retirer($this->org, $bail, 'terms');
    $ancien = R::terme($this->org, $bail, 'rent', [...R::loyer(60000), 'valid_to' => '2026-07-01']);
    R::terme($this->org, $bail, 'rent', [...R::loyer(65000), 'valid_from' => '2026-07-01', 'replaces_id' => $ancien->id]);

    expect(S::appliquer($this, $bail)->status)->toBe(LeaseStatus::Signed);
});

it('refuse un lot archivé et un locataire anonymisé', function (): void {
    ['bail' => $archive, 'lot' => $lot] = S::brouillon($this->org);
    L::dans($this->org, fn () => $lot->forceFill(['archived_at' => now()])->save());
    ['bail' => $anonyme, 'locataire' => $partie] = S::brouillon($this->org);
    L::dans($this->org, fn () => $partie->forceFill(['anonymized_at' => now()])->save());

    S::refus($this, $archive, 'lease_unit_not_available', 422);
    S::refus($this, $anonyme, 'lease_party_not_available', 422);
});

it('refuse des données de juridiction devenues invalides pour le régime', function (): void {
    ['bail' => $bail] = S::brouillon($this->org, ['jurisdiction_data' => ['champ_inconnu' => 'x']]);

    $this->postJson(S::url($this, $bail->id), S::corps($bail))->assertUnprocessable()->assertJsonValidationErrors('jurisdiction_data.champ_inconnu');

    expect(DB::table('leases')->where('id', $bail->id)->value('status'))->toBe('draft');
});

it('refuse un régime que la juridiction ne connaît plus', function (): void {
    ['bail' => $bail] = S::brouillon($this->org, ['regime_key' => 'fr.inexistant']);

    S::refus($this, $bail, 'jurisdiction_unsupported', 422);
});
