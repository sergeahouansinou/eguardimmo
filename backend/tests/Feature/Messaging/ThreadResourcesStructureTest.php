<?php

declare(strict_types=1);

use App\Modules\Messaging\Http\Resources\Counterpart\CounterpartMessageResource;
use App\Modules\Messaging\Http\Resources\Counterpart\CounterpartThreadResource;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Messaging\MessagingContext as M;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('documents');
    Storage::fake('local');
    L::semer();
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:00:00'));
    $this->org = T::organisation();
    $this->equipe = L::membre($this->org, MemberRole::Manager);
    $this->locataire = T::locataire($this->org);
    $this->mandant = O::proprietaire($this->org);
});

it('ne sert au locataire ni identifiant de fiche, ni identifiant de compte de l\'équipe, ni rôle interne', function (): void {
    $fil = M::filLocataire($this->org, $this->equipe, $this->locataire);
    $fil->forceFill(['assignee_user_id' => $this->equipe->id])->saveQuietly();

    foreach (['/api/v1/tenant/conversations', "/api/v1/tenant/conversations/{$fil->id}", "/api/v1/tenant/conversations/{$fil->id}/messages", '/api/v1/tenant/conversations/options'] as $url) {
        $texte = json_encode(T::comme($this, $this->locataire['user'])->getJson($url)->assertOk()->json(), JSON_THROW_ON_ERROR);

        expect($texte)->not->toContain($this->locataire['party']->id)->not->toContain($this->equipe->id)->not->toContain('party_id')->not->toContain('assignee')->not->toContain('"role"');
    }
});

it('ne sert au mandant ni identifiant de fiche, ni identifiant de compte de l\'équipe, ni assigné', function (): void {
    $fil = M::filMandant($this->org, $this->equipe, $this->mandant['party']->id);
    $fil->forceFill(['assignee_user_id' => $this->equipe->id])->saveQuietly();

    foreach (['/api/v1/owner/conversations', "/api/v1/owner/conversations/{$fil->id}", "/api/v1/owner/conversations/{$fil->id}/messages", '/api/v1/owner/conversations/options'] as $url) {
        $texte = json_encode(O::comme($this, $this->mandant['user'])->getJson($url)->assertOk()->json(), JSON_THROW_ON_ERROR);

        expect($texte)->not->toContain($this->mandant['party']->id)->not->toContain($this->equipe->id)->not->toContain('party_id')->not->toContain('assignee')->not->toContain('"role"');
    }
});

it('garde les Resources de la contrepartie sans clé d\'identifiant de fiche, de compte ou de note interne', function (): void {
    $source = file_get_contents((string) (new ReflectionClass(CounterpartThreadResource::class))->getFileName()).file_get_contents((string) (new ReflectionClass(CounterpartMessageResource::class))->getFileName());

    foreach (['party_id', 'author_user_id', 'assignee', 'created_by', 'user_id', 'internal'] as $interdit) {
        expect($source)->not->toContain("'{$interdit}'");
    }
});
