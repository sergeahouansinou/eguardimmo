<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext as R;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    L::semer();
    $this->travelTo(CarbonImmutable::parse(O::AUJOURDHUI));
    $this->org = T::organisation();
    $this->p = R::proprietaire($this->org);
    $this->autre = R::proprietaire($this->org, 'bob@exemple.fr');
});

it('liste les mandats du mandant avec honoraires, préavis et jour de reversement', function (): void {
    L::dans($this->org, fn () => $this->p['mandate']->forceFill(['note' => 'note interne', 'termination_note' => 'secret', 'notice_months' => 6, 'tacit_renewal' => true])->save());

    $reponse = R::lire($this, $this->p['user'], '/mandates')->assertOk()->assertJsonCount(1, 'data');
    $mandat = $reponse->json('data.0');

    expect($mandat)->toMatchArray([
        'id' => $this->p['mandate']->id,
        'reference' => $this->p['mandate']->reference,
        'status' => 'active',
        'notice_months' => 6,
        'tacit_renewal' => true,
        'starts_on' => '2026-01-01',
        'end_date' => '2028-12-31',
    ])->and($mandat['agency'])->toBe(['id' => $this->org->id, 'name' => $this->org->name])
        ->and($mandat['terms'])->toHaveKeys(['fee_kind', 'fee_basis_points', 'fee_tax_mode', 'payout_day', 'fee_minimum_amount'])
        ->and($mandat['units'])->toHaveCount(1)->and($mandat['units'][0]['id'])->toBe($this->p['unit']->id);
});

it('ne sert ni note interne, ni note de résiliation, ni champ personnalisé, ni plafond de travaux, ni fichier signé', function (): void {
    L::dans($this->org, fn () => $this->p['mandate']->forceFill([
        'note' => 'NOTE-INTERNE', 'termination_note' => 'NOTE-RESILIATION', 'termination_reason' => 'MOTIF-INTERNE',
        'custom_fields' => ['cle' => 'CHAMP-PERSO'], 'signed_file_id' => 'f4d6b1c0-0000-7000-8000-000000000001',
    ])->save());

    $texte = R::texte(R::lire($this, $this->p['user'], '/mandates')->assertOk());

    expect($texte)->not->toContain('NOTE-INTERNE')->and($texte)->not->toContain('NOTE-RESILIATION')->and($texte)->not->toContain('MOTIF-INTERNE')
        ->and($texte)->not->toContain('CHAMP-PERSO')->and($texte)->not->toContain('works_limit')->and($texte)->not->toContain('signed_file')
        ->and($texte)->not->toContain('custom_fields')->and($texte)->not->toContain($this->autre['party']->id);

    $detail = R::lire($this, $this->p['user'], '/mandates/'.$this->p['mandate']->id)->assertOk();
    expect(R::texte($detail))->not->toContain('NOTE-INTERNE')->and($detail->json('data.mandant.name'))->not->toBeNull();
});

it('refuse le mandat d\'un autre propriétaire de la même agence : 404 sans le distinguer d\'un mandat inconnu', function (): void {
    $inconnu = R::lire($this, $this->p['user'], '/mandates/'.fake()->uuid())->assertNotFound()->json();
    $autrui = R::lire($this, $this->p['user'], '/mandates/'.$this->autre['mandate']->id)->assertNotFound()->json();

    expect($autrui['code'])->toBe('owner_mandate_not_found')->and($autrui['code'])->toBe($inconnu['code']);
    R::lire($this, $this->autre['user'], '/mandates/'.$this->p['mandate']->id)->assertNotFound();
});

it('ne lit rien d\'une autre organisation, même quand son mandat porte l\'identifiant de mon mandant', function (): void {
    $autreOrg = T::organisation('Immo Loire');
    $piege = O::mandat($autreOrg, O::mandant($autreOrg, 'x@exemple.fr'), MandateStatus::Active, ['mandant_party_id' => $this->p['party']->id]);

    $reponse = R::lire($this, $this->p['user'], '/mandates')->assertOk()->assertJsonCount(1, 'data');

    expect(R::texte($reponse))->not->toContain($piege->id)->and(R::texte($reponse))->not->toContain($autreOrg->id);
    R::lire($this, $this->p['user'], '/mandates/'.$piege->id)->assertNotFound();
});

it('masque un brouillon et un mandat archivé', function (): void {
    $brouillon = O::mandat($this->org, $this->p['party'], MandateStatus::Draft);
    $archive = O::mandat($this->org, $this->p['party'], MandateStatus::Active, ['archived_at' => now()]);

    $ids = collect(R::lire($this, $this->p['user'], '/mandates')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$this->p['mandate']->id])->and($ids)->not->toContain($brouillon->id)->and($ids)->not->toContain($archive->id);
});

it('garde un mandat terminé lisible pendant la fenêtre de 12 mois, puis ne le sert plus', function (): void {
    L::dans($this->org, fn () => Mandate::query()->whereKey($this->p['mandate']->id)->update(['status' => MandateStatus::Terminated, 'ends_on' => '2026-01-01']));

    R::lire($this, $this->p['user'], '/mandates')->assertOk()->assertJsonCount(1, 'data');
    R::lire($this, $this->p['user'], '/mandates/'.$this->p['mandate']->id)->assertOk()->assertJsonPath('data.status', 'terminated');

    $this->travelTo(CarbonImmutable::parse('2027-01-01 08:00:00'));
    R::lire($this, $this->p['user'], '/mandates')->assertOk()->assertJsonCount(0, 'data');
    R::lire($this, $this->p['user'], '/mandates/'.$this->p['mandate']->id)->assertNotFound();
});

it('pagine par curseur sans répéter ni sauter de mandat', function (): void {
    $lots = collect(range(1, 4))->map(fn () => O::mandat($this->org, $this->p['party']))->each(
        fn (Mandate $m) => L::dans($this->org, fn () => $m->forceFill(['status' => MandateStatus::Active])->save()),
    );
    $vus = [];
    $url = '/mandates?per_page=2';

    do {
        $page = R::lire($this, $this->p['user'], $url)->assertOk();
        $vus = [...$vus, ...collect($page->json('data'))->pluck('id')->all()];
        $curseur = $page->json('meta.next_cursor');
        $url = '/mandates?per_page=2&cursor='.$curseur;
    } while ($curseur !== null);

    expect($vus)->toHaveCount(5)->and(array_unique($vus))->toHaveCount(5);
    R::lire($this, $this->p['user'], '/mandates?cursor=n-importe-quoi')->assertUnprocessable();
});

it('restreint à une agence par ?agency= et refuse une agence hors clé ou mal formée', function (): void {
    $autreOrg = T::organisation('Immo Loire');
    $lui = R::proprietaire($autreOrg, 'loire@exemple.fr');
    $compte = $this->p['user'];
    L::dans($autreOrg, fn () => $lui['access']->forceFill(['user_id' => $compte->id])->save());

    expect(R::lire($this, $compte, '/mandates')->assertOk()->json('data'))->toHaveCount(2);
    $filtre = R::lire($this, $compte, '/mandates?agency='.$autreOrg->id)->assertOk();
    expect($filtre->json('data'))->toHaveCount(1)->and($filtre->json('data.0.agency.id'))->toBe($autreOrg->id);

    $tiers = T::organisation('Tiers');
    R::lire($this, $compte, '/mandates?agency='.$tiers->id)->assertNotFound()->assertJsonPath('code', 'owner_agency_not_found');
    R::lire($this, $compte, '/mandates?agency=pas-un-uuid')->assertNotFound();
});

it('refuse un utilisateur sans profil propriétaire et sans session', function (): void {
    $this->getJson('/api/v1/owner/mandates')->assertUnauthorized();
    R::lire($this, User::factory()->create(), '/mandates')->assertForbidden();
    R::lire($this, T::locataire($this->org)['user'], '/mandates')->assertForbidden();
});

it('répond en no-store et privé', function (): void {
    $reponse = R::lire($this, $this->p['user'], '/mandates')->assertOk();

    expect($reponse->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');
});

it('lit les mandats en un nombre de requêtes indépendant de leur nombre', function (): void {
    $peu = R::requetes($this, $this->p['user'], '/mandates?per_page=100');

    foreach (range(1, 5) as $_) {
        $m = O::mandat($this->org, $this->p['party']);
        L::dans($this->org, fn () => $m->forceFill(['status' => MandateStatus::Active])->save());
    }

    expect(R::requetes($this, $this->p['user'], '/mandates?per_page=100'))->toBe($peu);
});
