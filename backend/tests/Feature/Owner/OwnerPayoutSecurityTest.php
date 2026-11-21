<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\OwnerAccess;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerPayoutContext as P;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

beforeEach(function (): void {
    ['org' => $this->org, 'mandant' => $this->mandant, 'bail' => $this->bail, 'awa' => $this->awa] = P::scene($this);
    $this->acces = P::acces($this->awa);
    $this->lignes = fn (): int => P::lignes($this->mandant->id);
    $this->vivantes = fn (): int => PayoutAccountRequest::query()->withoutGlobalScopes()->whereIn('status', ['awaiting_code', 'pending'])->count();
});

it('401 sans session sur chaque route du compte de paiement', function (): void {
    auth()->forgetGuards();
    $id = (string) Str::uuid();

    foreach ([['GET', ''], ['POST', '/requests'], ['POST', "/requests/{$id}/confirm"], ['DELETE', "/requests/{$id}"], ['POST', '/contest']] as [$verbe, $chemin]) {
        $this->json($verbe, '/api/v1/owner/payout-account'.$chemin)->assertUnauthorized();
    }
});

it('403 two_factor_required sans 2FA confirmée, rien d\'écrit', function (): void {
    $sans = User::factory()->create(['email' => 'sans@exemple.fr']);
    $mandant = O::mandant($this->org, 'sans@exemple.fr');
    O::mandat($this->org, $mandant);
    $acces = O::acces($this->org, $mandant, $sans);

    P::demander($this, $sans, $acces->id)->assertForbidden()->assertJsonPath('code', 'two_factor_required');
    O::comme($this, $sans)->postJson('/api/v1/owner/payout-account/contest', ['access_id' => $acces->id], O::ORIGINE)->assertForbidden()->assertJsonPath('code', 'two_factor_required');

    expect(($this->lignes)())->toBe(1)->and(($this->vivantes)())->toBe(0);
});

it('403 reauthentication_required sans preuve 2FA récente pour la demande', function (): void {
    $this->flushSession();
    P::demander($this, $this->awa, $this->acces, preuve: false)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    expect(($this->lignes)())->toBe(1)->and(($this->vivantes)())->toBe(0);
});

it('limite à 3 demandes par heure', function (): void {
    P::demander($this, $this->awa, $this->acces, limite: true)->assertCreated();
    P::demander($this, $this->awa, $this->acces, limite: true)->assertStatus(409);
    P::demander($this, $this->awa, $this->acces, limite: true)->assertStatus(409);

    P::demander($this, $this->awa, $this->acces, limite: true)->assertStatus(429);
});

it('refuse un co-indivisaire sans rien écrire et ne lui montre aucun compte', function (): void {
    $co = User::factory()->create(['email' => 'co@exemple.fr']);
    $acces = O::acces($this->org, $this->mandant, $co, OwnerAccessRole::CoOwner);
    activerDeuxFacteurs($co);

    expect(O::comme($this, $co)->getJson('/api/v1/owner/payout-account')->assertOk()->json('data'))->toBe([]);
    P::demander($this, $co, $acces->id)->assertForbidden()->assertJsonPath('code', 'owner_role_forbidden');
    O::comme($this, $co)->postJson('/api/v1/owner/payout-account/contest', ['access_id' => $acces->id], O::ORIGINE)->assertForbidden()->assertJsonPath('code', 'owner_role_forbidden');

    expect(($this->lignes)())->toBe(1);
});

it('pendant la grâce : lecture seule tant que le compte mandant est soldé, demande permise tant qu\'il ne l\'est pas', function (): void {
    L::dans($this->org, fn () => Mandate::query()->update(['status' => 'terminated', 'ends_on' => now()->subMonth()->toDateString()]));

    P::demander($this, $this->awa, $this->acces)->assertForbidden()->assertJsonPath('code', 'owner_access_read_only');
    expect(O::comme($this, $this->awa)->getJson('/api/v1/owner/payout-account')->json('data.0.can_request'))->toBeFalse()->and(($this->lignes)())->toBe(1);
});

it('pendant la grâce avec un solde non nul, la demande et la contestation restent possibles', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    L::dans($this->org, fn () => Mandate::query()->update(['status' => 'terminated', 'ends_on' => now()->subMonth()->toDateString()]));

    expect(O::comme($this, $this->awa)->getJson('/api/v1/owner/payout-account')->json('data.0.can_request'))->toBeTrue();
    P::demander($this, $this->awa, $this->acces)->assertCreated();
    O::comme($this, $this->awa)->postJson('/api/v1/owner/payout-account/contest', ['access_id' => $this->acces], O::ORIGINE)->assertOk();
});

it('IDOR : un autre mandant, un homonyme d\'une autre organisation et un accès inconnu donnent 404 sans rien écrire', function (): void {
    $autreMandant = O::mandant($this->org, 'bob@exemple.fr');
    O::mandat($this->org, $autreMandant);
    $bob = User::factory()->create(['email' => 'bob@exemple.fr']);
    $accesBob = O::acces($this->org, $autreMandant, $bob);
    activerDeuxFacteurs($bob);
    $ailleurs = L::organisation();
    $clone = O::mandant($ailleurs, 'awa@exemple.fr');
    O::mandat($ailleurs, $clone);
    $carl = User::factory()->create(['email' => 'carl@exemple.fr']);
    $accesCarl = O::acces($ailleurs, $clone, $carl);
    activerDeuxFacteurs($carl);

    $mienne = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
    $avant = ($this->lignes)();

    P::demander($this, $this->awa, $accesBob->id)->assertNotFound()->assertJsonPath('code', 'owner_access_not_found');
    P::demander($this, $this->awa, $accesCarl->id)->assertNotFound()->assertJsonPath('code', 'owner_access_not_found');
    P::demander($this, $this->awa, (string) Str::uuid())->assertNotFound()->assertJsonPath('code', 'owner_access_not_found');
    P::demander($this, $bob, $this->acces)->assertNotFound()->assertJsonPath('code', 'owner_access_not_found');
    P::confirmer($this, $bob, $mienne, '000000')->assertNotFound()->assertJsonPath('code', 'payout_account_request_not_found');
    P::confirmer($this, $carl, $mienne, '000000')->assertNotFound();
    O::comme($this, $bob)->deleteJson("/api/v1/owner/payout-account/requests/{$mienne}", [], O::ORIGINE)->assertNotFound();
    O::comme($this, $carl)->postJson('/api/v1/owner/payout-account/contest', ['access_id' => $this->acces], O::ORIGINE)->assertNotFound();

    expect(($this->lignes)())->toBe($avant)->and(PayoutAccountRequest::query()->withoutGlobalScopes()->find($mienne)->status->value)->toBe('awaiting_code')
        ->and(O::comme($this, $bob)->getJson('/api/v1/owner/payout-account')->assertOk()->getContent())->not->toContain($mienne);
});

it('ignore organization_id, mandant_party_id, status et bank_account_id fournis par le client', function (): void {
    $autre = O::mandant($this->org, 'bob@exemple.fr');

    $r = P::demander($this, $this->awa, $this->acces, [
        'organization_id' => (string) Str::uuid(), 'mandant_party_id' => $autre->id, 'status' => 'approved', 'bank_account_id' => (string) Str::uuid(),
    ])->assertCreated();

    $demande = PayoutAccountRequest::query()->withoutGlobalScopes()->findOrFail($r->json('data.id'));
    expect($demande->mandant_party_id)->toBe($this->mandant->id)->and($demande->organization_id)->toBe($this->org->id)->and($demande->status->value)->toBe('awaiting_code');
});

it('refuse un IBAN invalide, hors juridiction ou identique au compte actif, sans écrire', function (): void {
    P::demander($this, $this->awa, $this->acces, ['iban' => 'FR7630006000011234567890188'])->assertStatus(422)->assertJsonPath('code', 'payout_account_iban_invalid');
    P::demander($this, $this->awa, $this->acces, ['iban' => P::IBAN_HORS_JURIDICTION])->assertStatus(422)->assertJsonPath('code', 'payout_account_iban_invalid');
    P::demander($this, $this->awa, $this->acces, ['iban' => 'pas un iban'])->assertStatus(422);

    $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
    P::confirmer($this, $this->awa, $id)->assertOk();
    P::trancher($this, $this->org, $id, 'approve', P::approbation($id))->assertOk();
    $avant = ($this->lignes)();

    P::demander($this, $this->awa, $this->acces, ['iban' => 'fr76 3000 6000 0112 3456 7890 189'])->assertStatus(422)->assertJsonPath('code', 'payout_account_unchanged');

    expect(($this->lignes)())->toBe($avant);
});

it('valide la pièce justificative : type, taille, contenu exécutable ; rien n\'est écrit en cas de refus', function (): void {
    $texte = UploadedFile::fake()->createWithContent('rib.txt', 'bonjour');
    $gros = UploadedFile::fake()->createWithContent('rib.pdf', DocumentsContext::PDF.str_repeat('a', 5 * 1024 * 1024));
    $piege = UploadedFile::fake()->createWithContent('rib.pdf', DocumentsContext::PDF."<?php system('id'); ?>");

    P::demander($this, $this->awa, $this->acces, ['proof' => $texte])->assertStatus(422);
    P::demander($this, $this->awa, $this->acces, ['proof' => $gros])->assertStatus(422);
    P::demander($this, $this->awa, $this->acces, ['proof' => $piege])->assertStatus(422);
    P::demander($this, $this->awa, $this->acces, ['proof' => 'pas un fichier'])->assertStatus(422);

    expect(($this->lignes)())->toBe(1)->and(($this->vivantes)())->toBe(0);
});

it('une seule demande vivante par mandant, rejouable seulement après retrait', function (): void {
    $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');

    P::demander($this, $this->awa, $this->acces, ['iban' => P::IBAN_BIS])->assertStatus(409)->assertJsonPath('code', 'payout_account_request_pending');
    expect(($this->vivantes)())->toBe(1)->and(($this->lignes)())->toBe(2);

    O::comme($this, $this->awa)->deleteJson("/api/v1/owner/payout-account/requests/{$id}", [], O::ORIGINE)->assertOk();
    P::demander($this, $this->awa, $this->acces, ['iban' => P::IBAN_BIS])->assertCreated();
});

it('l\'index unique en base interdit deux demandes vivantes même hors de l\'application', function (): void {
    $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
    $copie = PayoutAccountRequest::query()->withoutGlobalScopes()->findOrFail($id)->replicate();
    $copie->id = (string) Str::uuid();

    expect(fn () => L::dans($this->org, fn () => $copie->save()))->toThrow(QueryException::class);
});

it('un compte révoqué voit sa demande en cours abandonnée', function (): void {
    $id = P::demander($this, $this->awa, $this->acces)->assertCreated()->json('data.id');
    P::confirmer($this, $this->awa, $id)->assertOk();

    O::comme($this, L::titulaire($this->org))->deleteJson('/api/v1/org/'.$this->org->id.'/parties/'.$this->mandant->id.'/owner-access/'.$this->acces)->assertSuccessful();

    $demande = PayoutAccountRequest::query()->withoutGlobalScopes()->findOrFail($id);
    expect($demande->status->value)->toBe('withdrawn')->and(BankAccount::query()->withoutGlobalScopes()->where('status', 'rejected')->count())->toBe(1)
        ->and(OwnerAccess::query()->withoutGlobalScopes()->find($this->acces)->status->value)->toBe('revoked');
});
