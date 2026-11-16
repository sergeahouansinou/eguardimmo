<?php

declare(strict_types=1);

use App\Modules\Catalog\Models\Term;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Models\Certificate;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Documents\DocumentsContext as D;

beforeEach(function (): void {
    Storage::fake('documents');
    $this->travelTo('2026-06-01 10:00:00');
    D::semer();
    $this->org = D::organisation();
    $this->titulaire = D::titulaire($this->org);
    $this->url = D::url($this->org, '/certificates');
    $this->corps = fn (string $type, array $surcharge = []): array => [
        'subject_type' => 'organization',
        'subject_id' => $this->org->id,
        'certificate_type_term_id' => D::type($type),
        'issued_on' => '2026-01-10',
        ...($type === 'energy_performance' ? ['values' => ['energy_class' => 'C']] : []),
        ...$surcharge,
    ];
});

it('protège les pièces : 401, 403 en écriture pour un comptable, lecture ouverte, 404 hors organisation', function (): void {
    $corps = ($this->corps)('energy_performance');

    $this->getJson($this->url)->assertUnauthorized();
    $this->postJson($this->url, $corps)->assertUnauthorized();
    $this->postJson("{$this->url}/".fake()->uuid().'/renew', [])->assertUnauthorized();

    $this->actingAs($this->titulaire);
    $id = $this->postJson($this->url, $corps)->assertCreated()->json('data.id');

    D::changerDeCompte($this, D::membre($this->org, MemberRole::Accountant));
    $this->getJson($this->url)->assertOk()->assertJsonCount(1, 'data');
    $this->getJson("{$this->url}/{$id}")->assertOk();
    $this->postJson($this->url, $corps)->assertForbidden();
    $this->postJson("{$this->url}/{$id}/renew", ['issued_on' => '2026-06-01'])->assertForbidden();

    $autre = D::organisation();
    D::changerDeCompte($this, D::titulaire($autre));
    $this->getJson(D::url($autre, "/certificates/{$id}"))->assertNotFound()->assertJsonPath('code', 'certificate_not_found');
    $this->postJson(D::url($autre, "/certificates/{$id}/renew"), ['issued_on' => '2026-06-01'])->assertNotFound();
    $this->getJson(D::url($autre, '/certificates'))->assertOk()->assertJsonCount(0, 'data');
    $this->getJson("/api/v1/org/{$this->org->id}/documents/certificates")->assertNotFound();
});

it('crée une pièce avec l\'échéance par défaut du type, l\'état calculé et le fichier joint', function (): void {
    $this->actingAs($this->titulaire);
    $fichier = D::dans($this->org, fn () => app(DocumentStore::class)->store(FileSource::contents(D::PDF), 'dpe.pdf', FileCategory::Certificate));

    $reponse = $this->postJson($this->url, ($this->corps)('energy_performance', ['reference' => 'DPE-2026-001', 'stored_file_id' => $fichier->id]))
        ->assertCreated()
        ->assertJsonPath('data.reference', 'DPE-2026-001')
        ->assertJsonPath('data.issued_on', '2026-01-10')
        ->assertJsonPath('data.expires_on', '2036-01-10')
        ->assertJsonPath('data.state', 'valid')
        ->assertJsonPath('data.type.key', 'energy_performance')
        ->assertJsonPath('data.type.semantic_key', 'energy_performance')
        ->assertJsonPath('data.stored_file_id', $fichier->id)
        ->assertJsonPath('data.replaces_id', null);

    expect(DB::table('certificates')->where('id', $reponse->json('data.id'))->value('expires_on'))->toBe('2036-01-10')
        ->and(DB::table('certificates')->where('id', $reponse->json('data.id'))->value('issued_on'))->toBe('2026-01-10');
});

it('valide la création : type, objet, dates, fichier d\'une autre organisation', function (): void {
    $this->actingAs($this->titulaire);
    $etranger = D::dans($autre = D::organisation(), fn () => app(DocumentStore::class)->store(FileSource::contents(D::PDF), 'x.pdf', FileCategory::Certificate));

    $this->postJson($this->url, ($this->corps)('gas', ['certificate_type_term_id' => fake()->uuid()]))->assertNotFound()->assertJsonPath('code', 'term_not_found');
    $this->postJson($this->url, ($this->corps)('gas', ['certificate_type_term_id' => D::dans($this->org, fn () => Term::query()->where('vocabulary', 'unit_type')->firstOrFail()->id)]))->assertNotFound();
    $this->postJson($this->url, ($this->corps)('gas', ['subject_id' => $autre->id]))->assertNotFound()->assertJsonPath('code', 'subject_not_found');
    $this->postJson($this->url, ($this->corps)('gas', ['subject_type' => 'tag']))->assertUnprocessable()->assertJsonValidationErrors('subject_type');
    $this->postJson($this->url, ($this->corps)('gas', ['expires_on' => '2025-12-31']))->assertUnprocessable()->assertJsonValidationErrors('expires_on');
    $this->postJson($this->url, ($this->corps)('gas', ['issued_on' => '10/01/2026']))->assertUnprocessable()->assertJsonValidationErrors('issued_on');
    $this->postJson($this->url, ($this->corps)('gas', ['stored_file_id' => $etranger->id]))->assertNotFound()->assertJsonPath('code', 'file_not_found');
    $this->postJson($this->url, ($this->corps)('gas', ['organization_id' => $autre->id]))->assertCreated();

    expect(DB::table('certificates')->where('organization_id', $autre->id)->count())->toBe(0);
});

it('valide data par le schéma porté par le type et refuse les champs inconnus', function (): void {
    $this->actingAs($this->titulaire);
    $type = D::typePropre($this->org, 'dpe_maison', ['data_schema' => [
        'energy_class' => ['type' => 'string', 'required' => true, 'enum' => ['A', 'B', 'C', 'D', 'E', 'F', 'G']],
        'guaranteed_amount' => ['type' => 'integer', 'min' => 0],
    ]]);
    $corps = fn (array $data) => ($this->corps)('gas', ['certificate_type_term_id' => $type, 'expires_on' => '2030-01-01', 'values' => $data]);

    $this->postJson($this->url, $corps(['energy_class' => 'C', 'guaranteed_amount' => 1500000]))->assertCreated()->assertJsonPath('data.values.energy_class', 'C')->assertJsonPath('data.values.guaranteed_amount', 1500000);
    $this->postJson($this->url, $corps([]))->assertUnprocessable()->assertJsonValidationErrors('values.energy_class');
    $this->postJson($this->url, $corps(['energy_class' => 'Z']))->assertUnprocessable()->assertJsonValidationErrors('values.energy_class');
    $this->postJson($this->url, $corps(['energy_class' => 'A', 'guaranteed_amount' => -1]))->assertUnprocessable()->assertJsonValidationErrors('values.guaranteed_amount');
    $this->postJson($this->url, $corps(['energy_class' => 'A', 'extra' => 'x']))->assertUnprocessable()->assertJsonValidationErrors('values.extra');
    $this->postJson($this->url, ($this->corps)('gas', ['values' => ['x' => 1]]))->assertUnprocessable()->assertJsonValidationErrors('values.x');
});

it('refuse un schéma de type invalide au lieu de l\'ignorer', function (): void {
    $this->actingAs($this->titulaire);
    $type = D::typePropre($this->org, 'casse', ['data_schema' => ['champ' => ['type' => 'exists:users,email']]]);

    $this->postJson($this->url, ($this->corps)('gas', ['certificate_type_term_id' => $type, 'expires_on' => '2030-01-01', 'values' => ['champ' => 'a']]))
        ->assertUnprocessable()->assertJsonPath('code', 'certificate_schema_invalid');
});

it('refuse à l\'exécution un schéma stocké dont le nom de champ contient un joker', function (): void {
    $this->actingAs($this->titulaire);
    $type = D::typePropre($this->org, 'joker', ['data_schema' => ['*' => ['type' => 'string'], 'a.b' => ['type' => 'string']]]);

    $this->postJson($this->url, ($this->corps)('gas', ['certificate_type_term_id' => $type, 'expires_on' => '2030-01-01', 'values' => ['x' => 'a']]))
        ->assertUnprocessable()->assertJsonPath('code', 'certificate_schema_invalid');
});

it('laisse l\'échéance vide quand le type n\'a pas de durée : toujours valide', function (): void {
    $this->actingAs($this->titulaire);

    $this->postJson($this->url, ($this->corps)('asbestos'))->assertCreated()->assertJsonPath('data.expires_on', null)->assertJsonPath('data.state', 'valid');
});

it('calcule l\'état depuis les dates figées et le délai de rappel du type, et filtre par état', function (): void {
    $this->actingAs($this->titulaire);
    $creer = fn (string $type, ?string $echeance, string $ref) => $this->postJson($this->url, ($this->corps)($type, ['expires_on' => $echeance, 'reference' => $ref]))->assertCreated()->json('data.id');

    $attendus = [
        'chaudiere-loin' => ['boiler_service', '2026-09-01', 'valid'],
        'chaudiere-rappel' => ['boiler_service', '2026-06-20', 'to_renew'],
        'chaudiere-limite-rappel' => ['boiler_service', '2026-07-01', 'to_renew'],
        'chaudiere-juste-avant-rappel' => ['boiler_service', '2026-07-02', 'valid'],
        'chaudiere-dernier-jour' => ['boiler_service', '2026-06-01', 'to_renew'],
        'chaudiere-hier' => ['boiler_service', '2026-05-31', 'expired'],
        'dpe-rappel-90j' => ['energy_performance', '2026-08-30', 'to_renew'],
        'dpe-hors-rappel' => ['energy_performance', '2026-08-31', 'valid'],
    ];
    $ids = [];

    foreach ($attendus as $ref => [$type, $echeance]) {
        $ids[$ref] = $creer($type, $echeance, $ref);
    }

    foreach ($attendus as $ref => [, , $etat]) {
        $this->getJson("{$this->url}/{$ids[$ref]}")->assertJsonPath('data.state', $etat);
    }

    foreach (['valid', 'to_renew', 'expired'] as $etat) {
        $filtre = $this->getJson("{$this->url}?state={$etat}&per_page=100")->assertOk()->json('data.*.reference');
        $voulu = array_keys(array_filter($attendus, fn (array $a): bool => $a[2] === $etat));

        expect($filtre)->toEqualCanonicalizing($voulu);
    }

    $this->getJson("{$this->url}?state=bientot")->assertUnprocessable()->assertJsonValidationErrors('state');

    $this->travelTo('2026-06-02 08:00:00');
    $this->getJson("{$this->url}/{$ids['chaudiere-dernier-jour']}")->assertJsonPath('data.state', 'expired');
    $this->getJson("{$this->url}?state=expired&per_page=100")->assertJsonCount(2, 'data');
});

it('inclut dans le filtre « valide » les pièces sans échéance', function (): void {
    $this->actingAs($this->titulaire);
    $this->postJson($this->url, ($this->corps)('asbestos', ['reference' => 'sans-echeance']))->assertCreated();
    $this->postJson($this->url, ($this->corps)('boiler_service', ['reference' => 'expiree', 'expires_on' => '2026-01-11']))->assertCreated();

    $this->getJson("{$this->url}?state=valid")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.reference', 'sans-echeance');
    $this->getJson("{$this->url}?state=to_renew")->assertOk()->assertJsonCount(0, 'data');
});

it('renouvelle par une nouvelle pièce qui remplace la précédente, une seule fois', function (): void {
    $this->actingAs($this->titulaire);
    $ancienne = $this->postJson($this->url, ($this->corps)('boiler_service', ['reference' => 'CH-2025', 'expires_on' => '2026-06-10', 'issuer_party_id' => $emetteur = D::partie($this->org)]))->json('data.id');

    $nouvelle = $this->postJson("{$this->url}/{$ancienne}/renew", ['reference' => 'CH-2026', 'issued_on' => '2026-06-05'])
        ->assertCreated()
        ->assertJsonPath('data.replaces_id', $ancienne)
        ->assertJsonPath('data.type.key', 'boiler_service')
        ->assertJsonPath('data.subject.id', $this->org->id)
        ->assertJsonPath('data.issuer_party_id', $emetteur)
        ->assertJsonPath('data.expires_on', '2027-06-05')
        ->assertJsonPath('data.state', 'valid')
        ->json('data.id');

    $this->getJson("{$this->url}/{$ancienne}")->assertJsonPath('data.replaced_by_id', $nouvelle)->assertJsonPath('data.state', 'to_renew');
    $this->getJson($this->url)->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $nouvelle);
    $this->getJson("{$this->url}?include_replaced=1")->assertJsonCount(2, 'data');
    $this->getJson("{$this->url}?state=to_renew")->assertJsonCount(0, 'data');

    $this->postJson("{$this->url}/{$ancienne}/renew", ['issued_on' => '2026-06-06'])->assertConflict()->assertJsonPath('code', 'certificate_already_replaced');
    $this->postJson("{$this->url}/{$nouvelle}/renew", ['issued_on' => '2027-05-01', 'expires_on' => '2028-05-01'])->assertCreated()->assertJsonPath('data.expires_on', '2028-05-01');
    $this->postJson("{$this->url}/".fake()->uuid().'/renew', ['issued_on' => '2026-06-06'])->assertNotFound();
    $this->postJson("{$this->url}/{$nouvelle}/renew", ['expires_on' => '2028-05-01'])->assertUnprocessable()->assertJsonValidationErrors('issued_on');

    expect(DB::table('certificates')->count())->toBe(3);
});

it('filtre par objet et par type', function (): void {
    $this->actingAs($this->titulaire);
    $this->postJson($this->url, ($this->corps)('gas', ['reference' => 'gaz']))->assertCreated();
    $this->postJson($this->url, ($this->corps)('electricity', ['reference' => 'elec']))->assertCreated();

    $this->getJson("{$this->url}?subject_type=organization&subject_id={$this->org->id}")->assertJsonCount(2, 'data');
    $this->getJson("{$this->url}?subject_type=organization&subject_id=".fake()->uuid())->assertJsonCount(0, 'data');
    $this->getJson("{$this->url}?subject_type=organization")->assertUnprocessable()->assertJsonValidationErrors('subject_id');
    $this->getJson("{$this->url}?certificate_type_term_id=".D::type('gas'))->assertJsonCount(1, 'data')->assertJsonPath('data.0.reference', 'gaz');

    $page = $this->getJson("{$this->url}?per_page=1")->assertJsonCount(1, 'data');
    $suite = $this->getJson("{$this->url}?per_page=1&cursor=".$page->json('meta.next_cursor'))->assertJsonCount(1, 'data');
    expect($suite->json('data.0.id'))->not->toBe($page->json('data.0.id'));
    $this->getJson("{$this->url}?cursor=n-importe-quoi")->assertUnprocessable();
});

it('journalise la création et le renouvellement d\'une pièce', function (): void {
    $this->actingAs($this->titulaire);
    $id = $this->postJson($this->url, ($this->corps)('gas'))->json('data.id');
    $this->postJson("{$this->url}/{$id}/renew", ['issued_on' => '2026-06-01'])->assertCreated();

    expect(AuditLog::query()->where('action', 'certificate.created')->count())->toBe(2)
        ->and(D::dans($this->org, fn () => Certificate::query()->count()))->toBe(2);
});

it('refuse un DPE sans classe énergétique ou avec une classe hors schéma', function (): void {
    $this->actingAs($this->titulaire);

    $this->postJson($this->url, [...($this->corps)('energy_performance'), 'values' => []])->assertUnprocessable()->assertJsonValidationErrors('values.energy_class');
    $this->postJson($this->url, [...($this->corps)('energy_performance'), 'values' => ['energy_class' => 'Z']])->assertUnprocessable()->assertJsonValidationErrors('values.energy_class');
});

it('refuse un émetteur inconnu ou d\'une autre organisation : 404 party_not_found, rien d\'écrit', function (): void {
    $this->actingAs($this->titulaire);
    $etrangere = D::partie(D::organisation());

    foreach ([$etrangere, fake()->uuid()] as $emetteur) {
        $this->postJson($this->url, ($this->corps)('boiler_service', ['issuer_party_id' => $emetteur]))->assertNotFound()->assertJsonPath('code', 'party_not_found');
    }

    expect(DB::table('certificates')->count())->toBe(0);

    $this->postJson($this->url, ($this->corps)('boiler_service', ['issuer_party_id' => D::partie($this->org)]))->assertCreated();
});
