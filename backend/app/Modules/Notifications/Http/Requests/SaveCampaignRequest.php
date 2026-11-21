<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests;

use App\Modules\Notifications\Data\CampaignInput;
use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Support\MergeFields;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class SaveCampaignRequest extends FormRequest
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
            'body' => ['nullable', 'string', 'max:10000'],
            'audience' => ['required', Rule::enum(CampaignAudience::class)],
            'building_ids' => ['nullable', 'array', 'max:200'],
            'building_ids.*' => ['uuid', 'distinct'],
            'copy_to_history' => ['nullable', 'boolean'],
            'lock_version' => [$this->isMethod('PATCH') ? 'required' : 'prohibited', 'integer', 'min:1'],
        ];
    }

    /**
     * @return list<Closure(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validateur): void {
            $audience = CampaignAudience::tryFrom((string) $this->input('audience'));

            if ($audience === null) {
                return;
            }

            foreach (['subject', 'body'] as $champ) {
                $inconnus = MergeFields::unknownIn((string) $this->input($champ), $audience);

                if ($inconnus !== []) {
                    $validateur->errors()->add($champ, 'Champ de fusion inconnu : '.implode(', ', $inconnus).'.');
                }
            }
        }];
    }

    public function toData(): CampaignInput
    {
        return new CampaignInput(
            trim((string) $this->string('subject')),
            (string) $this->string('body'),
            CampaignAudience::from((string) $this->string('audience')),
            array_values(array_map('strval', (array) $this->input('building_ids', []))),
            $this->boolean('copy_to_history'),
        );
    }

    public function version(): int
    {
        return $this->integer('lock_version');
    }
}
