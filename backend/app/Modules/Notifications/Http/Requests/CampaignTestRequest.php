<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests;

use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Support\MergeFields;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Aucun destinataire dans la requête : l'envoi de test va à l'adresse de l'auteur seulement.
 */
final class CampaignTestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'subject' => ['required', 'string', 'max:140'],
            'body' => ['required', 'string', 'max:10000'],
            'audience' => ['nullable', Rule::enum(CampaignAudience::class)],
        ];
    }

    /**
     * @return list<Closure(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validateur): void {
            foreach (['subject', 'body'] as $champ) {
                $inconnus = MergeFields::unknownIn((string) $this->input($champ), $this->audience());

                if ($inconnus !== []) {
                    $validateur->errors()->add($champ, 'Champ de fusion inconnu : '.implode(', ', $inconnus).'.');
                }
            }
        }];
    }

    public function audience(): CampaignAudience
    {
        return CampaignAudience::tryFrom((string) $this->input('audience', 'tenants')) ?? CampaignAudience::Tenants;
    }
}
