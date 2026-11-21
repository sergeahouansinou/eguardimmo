<?php

declare(strict_types=1);

use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\PartyIdentifier;
use App\Shared\Audit\AuditLog;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Parties\PartiesContext as C;

const PARTIES_IBAN = 'FR7630006000011234567890189';
const PARTIES_IBAN_2 = 'GB82WEST12345698765432';

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->partie = C::partie($this->org, ['last_name' => 'Dupont', 'first_name' => 'Jean', 'display_name' => 'Jean Dupont']);
    C::sessionAgence($this, C::titulaire($this->org));
    $this->url = C::url($this->org, "/{$this->partie->id}");
});

it('rend la première coordonnée d\'un type principale et déplace le rang sans jamais en garder deux', function (): void {
    $premier = $this->postJson("{$this->url}/contact-points", ['type' => 'email', 'value' => ' Jean.Dupont@Exemple.FR ', 'label' => 'Domicile'])
        ->assertCreated()
        ->assertJsonPath('data.value', 'jean.dupont@exemple.fr')
        ->assertJsonPath('data.is_primary', true)
        ->json('data.id');
    $second = $this->postJson("{$this->url}/contact-points", ['type' => 'email', 'value' => 'pro@exemple.fr'])->assertCreated()->assertJsonPath('data.is_primary', false)->json('data.id');
    $telephone = $this->postJson("{$this->url}/contact-points", ['type' => 'phone', 'value' => '06 12 34 56 78'])->assertCreated()->assertJsonPath('data.value', '0612345678')->assertJsonPath('data.is_primary', true)->json('data.id');

    $this->patchJson("{$this->url}/contact-points/{$second}", ['is_primary' => true])->assertOk()->assertJsonPath('data.is_primary', true);

    $principaux = C::dans($this->org, fn () => ContactPoint::query()->where('is_primary', true)->orderBy('type')->pluck('id')->all());
    expect($principaux)->toEqualCanonicalizing([$second, $telephone]);
    $this->getJson($this->url)->assertJsonCount(3, 'data.contact_points');
    $this->getJson(C::url($this->org))->assertJsonPath('data.0.primary_email', 'pro@exemple.fr')->assertJsonPath('data.0.primary_phone', '0612345678');

    $this->patchJson("{$this->url}/contact-points/{$premier}", ['label' => 'Perso', 'value' => 'perso@exemple.fr'])->assertOk()->assertJsonPath('data.label', 'Perso');
    $this->patchJson("{$this->url}/contact-points/{$premier}", ['is_primary' => false])->assertUnprocessable()->assertJsonValidationErrors('is_primary');
});

it('garantit en base un seul principal par type', function (): void {
    $this->postJson("{$this->url}/contact-points", ['type' => 'email', 'value' => 'a@exemple.fr'])->assertCreated();

    $insertion = fn () => DB::table('contact_points')->insert([
        'id' => fake()->uuid(), 'organization_id' => $this->org->id, 'party_id' => $this->partie->id, 'type' => 'email',
        'value' => 'b@exemple.fr', 'is_primary' => true, 'primary_slot' => 1, 'created_at' => now(), 'updated_at' => now(),
    ]);

    expect($insertion)->toThrow(QueryException::class);
});

it('refuse une coordonnée en double ou invalide', function (): void {
    $url = "{$this->url}/contact-points";
    $this->postJson($url, ['type' => 'email', 'value' => 'a@exemple.fr'])->assertCreated();

    $this->postJson($url, ['type' => 'email', 'value' => 'A@exemple.fr'])->assertConflict()->assertJsonPath('code', 'contact_point_exists');
    $this->postJson($url, ['type' => 'email', 'value' => 'pas-un-email'])->assertUnprocessable()->assertJsonValidationErrors('value');
    $this->postJson($url, ['type' => 'phone', 'value' => 'abc'])->assertUnprocessable()->assertJsonValidationErrors('value');
    $this->postJson($url, ['type' => 'fax', 'value' => '1'])->assertUnprocessable()->assertJsonValidationErrors('type');

    $autre = $this->postJson($url, ['type' => 'email', 'value' => 'b@exemple.fr'])->json('data.id');
    $this->patchJson("{$url}/{$autre}", ['value' => 'a@exemple.fr'])->assertConflict();
    $this->patchJson("{$url}/".fake()->uuid(), ['label' => 'x'])->assertNotFound()->assertJsonPath('code', 'contact_point_not_found');

    $autreFiche = C::partie($this->org);
    $this->patchJson(C::url($this->org, "/{$autreFiche->id}/contact-points/{$autre}"), ['label' => 'x'])->assertNotFound();
});

it('chiffre l\'identifiant en base et ne rend jamais une pièce d\'identité en clair', function (): void {
    $siret = $this->postJson("{$this->url}/identifiers", ['scheme' => 'siret', 'country' => 'FR', 'value' => '123 456 789 00012'])
        ->assertCreated()
        ->assertJsonPath('data.value', '12345678900012')
        ->assertJsonPath('data.last4', '0012')
        ->json('data.id');
    $passeport = $this->postJson("{$this->url}/identifiers", ['scheme' => 'passport', 'country' => 'FR', 'value' => '12AB34567'])
        ->assertCreated()
        ->assertJsonPath('data.value', null)
        ->assertJsonPath('data.last4', '4567')
        ->json('data.id');

    foreach ([$siret => '12345678900012', $passeport => '12AB34567'] as $id => $clair) {
        $brut = DB::table('party_identifiers')->where('id', $id)->first();
        expect($brut->value)->not->toBe($clair)->and($brut->value)->not->toContain($clair)
            ->and($brut->value_hash)->toMatch('/^[0-9a-f]{64}$/')->and($brut->value_hash)->not->toContain($clair);
    }

    expect(C::dans($this->org, fn () => PartyIdentifier::query()->findOrFail($passeport)->value))->toBe('12AB34567');
    $this->getJson($this->url)->assertJsonCount(2, 'data.identifiers')->assertJsonMissing(['12AB34567']);
});

it('refuse un identifiant mal formé ou déjà porté par une autre fiche, et l\'autorise dans une autre organisation', function (): void {
    $url = "{$this->url}/identifiers";
    $this->postJson($url, ['scheme' => 'siren', 'country' => 'FR', 'value' => '12345'])->assertUnprocessable()->assertJsonValidationErrors('value');
    $this->postJson($url, ['scheme' => 'secret', 'country' => 'FR', 'value' => '123456789'])->assertUnprocessable()->assertJsonValidationErrors('scheme');
    $this->postJson($url, ['scheme' => 'siren', 'country' => 'France', 'value' => '123456789'])->assertUnprocessable()->assertJsonValidationErrors('country');

    $this->postJson($url, ['scheme' => 'siren', 'country' => 'FR', 'value' => '123 456 789'])->assertCreated();
    $this->postJson($url, ['scheme' => 'siren', 'country' => 'FR', 'value' => '123456789'])->assertConflict()->assertJsonPath('code', 'identifier_taken');

    $autre = C::partie($this->org);
    $this->postJson(C::url($this->org, "/{$autre->id}/identifiers"), ['scheme' => 'siren', 'country' => 'FR', 'value' => '123456789'])->assertConflict();
    $this->postJson(C::url($this->org, "/{$autre->id}/identifiers"), ['scheme' => 'siren', 'country' => 'BE', 'value' => '123456789'])->assertCreated();

    $autreOrg = C::organisation();
    $fiche = C::partie($autreOrg);
    C::sessionAgence($this, C::titulaire($autreOrg))
        ->postJson(C::url($autreOrg, "/{$fiche->id}/identifiers"), ['scheme' => 'siren', 'country' => 'FR', 'value' => '123456789'])
        ->assertCreated();
});

it('modifie un identifiant en recalculant son empreinte', function (): void {
    $id = $this->postJson("{$this->url}/identifiers", ['scheme' => 'siren', 'country' => 'FR', 'value' => '123456789'])->json('data.id');
    $avant = DB::table('party_identifiers')->where('id', $id)->value('value_hash');
    $pris = $this->postJson("{$this->url}/identifiers", ['scheme' => 'siren', 'country' => 'BE', 'value' => '987654321'])->json('data.id');

    $this->patchJson("{$this->url}/identifiers/{$id}", ['value' => '111222333'])->assertOk()->assertJsonPath('data.value', '111222333');
    expect(DB::table('party_identifiers')->where('id', $id)->value('value_hash'))->not->toBe($avant);

    $this->patchJson("{$this->url}/identifiers/{$id}", ['value' => '12'])->assertUnprocessable();
    $this->patchJson("{$this->url}/identifiers/{$id}", ['country' => 'BE', 'value' => '987654321'])->assertConflict();
    $this->patchJson("{$this->url}/identifiers/".fake()->uuid(), ['value' => '111222333'])->assertNotFound()->assertJsonPath('code', 'identifier_not_found');
    expect($pris)->not->toBe($id);
});

it('ajoute un compte bancaire : IBAN chiffré, quatre derniers chiffres seuls renvoyés', function (): void {
    $id = $this->postJson("{$this->url}/bank-accounts", ['iban' => 'FR76 3000 6000 0112 3456 7890 189', 'bic' => 'agrifrpp', 'holder_name' => 'Jean Dupont', 'valid_from' => '2026-01-01'])
        ->assertCreated()
        ->assertJsonPath('data.iban_last4', '0189')
        ->assertJsonPath('data.bic', 'AGRIFRPP')
        ->assertJsonPath('data.valid_from', '2026-01-01')
        ->assertJsonPath('data.valid_to', null)
        ->assertJsonMissingPath('data.iban')
        ->json('data.id');

    $brut = DB::table('bank_accounts')->where('id', $id)->first();
    expect($brut->iban)->not->toContain(PARTIES_IBAN)->and($brut->iban)->not->toContain('3000600001')
        ->and($brut->iban_last4)->toBe('0189')
        ->and(C::dans($this->org, fn () => BankAccount::query()->findOrFail($id)->iban))->toBe(PARTIES_IBAN);

    $page = $this->getJson($this->url)->assertOk();
    expect(json_encode($page->json()))->not->toContain(PARTIES_IBAN)->not->toContain('30006000');
});

it('refuse un IBAN invalide (mod 97, forme) ou un doublon actif', function (): void {
    $url = "{$this->url}/bank-accounts";

    foreach (['FR7630006000011234567890188', 'FR76', 'XX00ABC', '1234567890', 'FR76 3000 6000 0112 3456 7890 18!'] as $mauvais) {
        $this->postJson($url, ['iban' => $mauvais, 'holder_name' => 'Jean Dupont'])->assertUnprocessable()->assertJsonValidationErrors('iban');
    }

    $this->postJson($url, ['holder_name' => 'Jean Dupont'])->assertUnprocessable()->assertJsonValidationErrors('iban');
    $this->postJson($url, ['iban' => PARTIES_IBAN])->assertUnprocessable()->assertJsonValidationErrors('holder_name');
    $this->postJson($url, ['iban' => PARTIES_IBAN, 'holder_name' => 'J', 'bic' => 'abc'])->assertUnprocessable()->assertJsonValidationErrors('bic');

    $this->postJson($url, ['iban' => PARTIES_IBAN, 'holder_name' => 'Jean Dupont'])->assertCreated();
    $this->postJson($url, ['iban' => strtolower(PARTIES_IBAN), 'holder_name' => 'Jean Dupont'])->assertConflict()->assertJsonPath('code', 'bank_account_exists');

    expect(C::dans($this->org, fn () => BankAccount::query()->count()))->toBe(1);
});

it('remplace un IBAN en gardant l\'historique : ancienne ligne close, jamais réécrite', function (): void {
    $ancien = $this->postJson("{$this->url}/bank-accounts", ['iban' => PARTIES_IBAN, 'holder_name' => 'Jean Dupont', 'valid_from' => '2026-01-01'])->json('data.id');
    $avant = DB::table('bank_accounts')->where('id', $ancien)->first();

    $nouveau = $this->postJson("{$this->url}/bank-accounts/{$ancien}/replacement", ['iban' => PARTIES_IBAN_2, 'holder_name' => 'Jean Dupont', 'valid_from' => '2026-06-01'])
        ->assertCreated()
        ->assertJsonPath('data.iban_last4', '5432')
        ->assertJsonPath('data.valid_to', null)
        ->json('data.id');

    $apres = DB::table('bank_accounts')->where('id', $ancien)->first();
    expect($apres->iban)->toBe($avant->iban)->and($apres->iban_last4)->toBe('0189')->and($apres->iban_hash)->toBe($avant->iban_hash)
        ->and($apres->valid_from)->toBe($avant->valid_from)->and(substr((string) $apres->valid_to, 0, 10))->toBe('2026-06-01');
    expect(C::dans($this->org, fn () => BankAccount::query()->count()))->toBe(2);

    $historique = $this->getJson($this->url)->json('data.bank_accounts');
    expect(array_column($historique, 'id'))->toBe([$nouveau, $ancien])
        ->and(array_column($historique, 'is_active'))->toBe([true, false]);

    $this->postJson("{$this->url}/bank-accounts/{$ancien}/replacement", ['iban' => PARTIES_IBAN, 'holder_name' => 'Jean Dupont'])
        ->assertConflict()->assertJsonPath('code', 'bank_account_closed');
    $this->postJson("{$this->url}/bank-accounts/{$nouveau}/replacement", ['iban' => PARTIES_IBAN_2, 'holder_name' => 'Jean Dupont', 'valid_from' => '2026-07-01'])
        ->assertConflict()->assertJsonPath('code', 'bank_account_exists');
    $this->postJson("{$this->url}/bank-accounts/{$nouveau}/replacement", ['iban' => PARTIES_IBAN, 'holder_name' => 'Jean Dupont', 'valid_from' => '2026-05-01'])
        ->assertUnprocessable()->assertJsonPath('code', 'bank_account_period_invalid');
    $this->postJson("{$this->url}/bank-accounts/".fake()->uuid().'/replacement', ['iban' => PARTIES_IBAN, 'holder_name' => 'Jean Dupont'])
        ->assertNotFound()->assertJsonPath('code', 'bank_account_not_found');

    expect(C::dans($this->org, fn () => BankAccount::query()->count()))->toBe(2);
});

it('ne journalise aucune donnée personnelle en clair', function (): void {
    $this->postJson("{$this->url}/contact-points", ['type' => 'email', 'value' => 'secret.jean@exemple.fr', 'label' => 'Maison'])->assertCreated();
    $this->postJson("{$this->url}/identifiers", ['scheme' => 'passport', 'country' => 'FR', 'value' => '12AB34567'])->assertCreated();
    $this->postJson("{$this->url}/bank-accounts", ['iban' => PARTIES_IBAN, 'bic' => 'AGRIFRPP', 'holder_name' => 'Jean Titulaire', 'valid_from' => '2026-01-01'])->assertCreated();
    $this->patchJson($this->url, ['lock_version' => 1, 'last_name' => 'Durand', 'first_name' => 'Marcel', 'birth_date' => '1980-02-03', 'address' => ['line1' => '5 rue Secrète', 'postal_code' => '13001', 'city' => 'Marseille', 'country' => 'FR']])->assertOk();

    $journal = AuditLog::query()->whereIn('subject_type', ['party', 'contact_point', 'party_identifier', 'bank_account'])->get();
    $texte = json_encode($journal->map(fn (AuditLog $ligne): array => [$ligne->changes, $ligne->metadata])->all(), JSON_UNESCAPED_UNICODE);

    expect($journal->pluck('subject_type')->unique()->sort()->values()->all())->toBe(['bank_account', 'contact_point', 'party', 'party_identifier'])
        ->and($texte)->toContain('[masqué]');

    foreach (['secret.jean', 'Maison', '12AB34567', PARTIES_IBAN, '0189', 'AGRIFRPP', 'Jean Titulaire', 'Dupont', 'Durand', 'Marcel', 'Jean Dupont', '1980-02-03', '5 rue', 'Secrète'] as $clair) {
        expect($texte)->not->toContain($clair);
    }
});
